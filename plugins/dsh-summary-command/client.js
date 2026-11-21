/**
 * dsh-summary-command — the OpenChamber `/summary` magic prompt as one row of
 * the composer's `/` menu.
 *
 * The command is a Client-side trigger source rather than a Host command
 * definition: only the Client owns a menu row's presentation (localized label,
 * localized description, icon), and a Host `CommandDefinition` carries none of
 * those. Registering `/` here also keeps the optional topic argument, which the
 * `commandUi.register` contribution form cannot accept (it only takes bare
 * invocations).
 *
 * `/summary` (optionally `/summary <topic>`) submits one model-visible user
 * message into the current session through the session's own prompt path, so
 * the user's draft and attachments stay untouched. The message pairs
 * OpenChamber's visible request with its hidden summary instructions, so the
 * agent answers with a compact, non-destructive summary suitable for handing
 * the work off to a new session.
 */

window.__ModuleLoader__.load({
	id: "dsh-summary-command",
	factory(require) {
		const NS = "summaryCommand";

		// ---------------------------------------------------------------------------
		// Locale
		// ---------------------------------------------------------------------------
		const DICTS = {
			en: {
				label: "Summary",
				description: "Summarize this conversation for hand-off",
				hint: "[topic]",
				attachments: "/summary does not accept attachments; remove them first",
				unavailable: "This session cannot accept a summary request.",
				failed: "Summary could not be submitted."
			},
			zh: {
				label: "总结",
				description: "总结本会话，便于交接",
				hint: "[主题]",
				attachments: "/summary 不接受附件，请先移除附件",
				unavailable: "当前会话无法接收总结请求。",
				failed: "总结请求提交失败。"
			}
		};

		const fallbackTranslate = (key) => DICTS.en[key] ?? key;

		/** Services captured at apply() time; the claim callbacks close over this record. */
		const services = {
			translate: fallbackTranslate,
			locale: null
		};

		/** Module-scope handles the trigger callbacks use; filled by apply(). */
		const runtime = {
			ctx: null
		};

		// ---------------------------------------------------------------------------
		// Menu row glyph
		// ---------------------------------------------------------------------------
		/** Row glyph from the browser's shared icon set; a Composition without the module keeps a text-only row. */
		const icon = (() => {
			try {
				const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
				const glyph = primitives?.IconListPenOutlineRegular;
				return typeof glyph === "function" ? glyph : null;
			} catch {
				return null;
			}
		})();

		// ---------------------------------------------------------------------------
		// Prompt
		// ---------------------------------------------------------------------------
		/**
		 * OpenChamber's `session.summary.instructions` magic prompt
		 * (packages/ui/src/lib/magicPrompts.ts), ported with its
		 * `{{topic_block}}` placeholder intact.
		 */
		const SUMMARY_INSTRUCTIONS = `Produce a non-destructive summary of this conversation. Do NOT compact or mutate session history — your output is an additional assistant message the user will read and may use to hand off to a new session.

Cover the information useful for continuing this work:
- What was done (completed work, in order)
- What is currently in progress
- Files modified — brief what and why per file
- Open questions and next steps
- User requests, constraints, or preferences to carry forward
- Important technical decisions and why they were made

{{topic_block}}

Formatting:
- Concise markdown with short sections and bullet lists
- No preamble like "Here is a summary" — jump straight to content
- Do not answer questions found in the conversation — only summarize
- Keep length proportional to session length; do not pad

Respond in the same language the user used most in the conversation.`;

		/** Render the visible request line and the topic focus paragraph. */
		function buildPrompt(topic) {
			const visibleLine = topic.length > 0 ? `Summarize this session, focused on: ${topic}.` : "Summarize this session.";
			const topicBlock = topic.length > 0 ? `The user asked you to focus this summary on: ${topic}. Prioritize that topic; mention unrelated threads only in passing.` : "";
			const instructions = SUMMARY_INSTRUCTIONS.replace("{{topic_block}}", topicBlock);
			return `${visibleLine}\n\n${instructions}`;
		}

		// ---------------------------------------------------------------------------
		// Delivery
		// ---------------------------------------------------------------------------
		/**
		 * Submit one summary request through the session's prompt path.
		 * @param sessionId - session the composer belongs to.
		 * @param topic - optional focus text.
		 * @returns the claim settlement.
		 */
		function sendSummary(sessionId, topic) {
			const failed = (text) => ({ kind: "error", text });
			const ctx = runtime.ctx;
			if (ctx === null) return Promise.resolve(failed(services.translate("unavailable")));
			const sessions = ctx.get("sessions");
			if (sessions === undefined) return Promise.resolve(failed(services.translate("unavailable")));
			const binding = sessions.binding(sessionId);
			const session = binding?.session;
			if (session === undefined || typeof session.prompt !== "function") {
				return Promise.resolve(failed(services.translate("unavailable")));
			}
			const text = buildPrompt(topic);
			// The echo makes the message appear immediately, before the Host
			// round-trip lands; without it the row still submits, just later.
			let echo;
			try {
				if (typeof session.beginSubmission === "function") {
					echo = session.beginSubmission({ mode: "queue", text, attachments: [] });
				}
			} catch {
				echo = undefined;
			}
			let submitted;
			try {
				submitted = session.prompt([{ type: "text", text }], "queue", undefined, echo?.requestId);
			} catch (error) {
				echo?.abandon?.();
				return Promise.resolve(failed(String(error?.message ?? services.translate("failed"))));
			}
			return Promise.resolve(submitted).then(
				(result) => {
					if (result?.ok === true) return { kind: "success" };
					echo?.abandon?.();
					return failed(result?.error?.message ?? services.translate("failed"));
				},
				(error) => {
					echo?.abandon?.();
					return failed(String(error?.message ?? services.translate("failed")));
				}
			);
		}

		/**
		 * Build the claim the composer keeps between picking `/summary` and
		 * submitting the line.
		 * @param sessionId - session the composer belongs to.
		 * @returns one command claim.
		 */
		function claimFor(sessionId) {
			return {
				name: "summary",
				token: "/summary ",
				hint: services.translate("hint"),
				submit: (args) => sendSummary(sessionId, String(args ?? "").trim())
			};
		}

		// ---------------------------------------------------------------------------
		// `/` menu row
		// ---------------------------------------------------------------------------
		/** Query letters the row answers to, besides the localized label. */
		const NAME = "summary";

		/** Whether a typed query should keep the row visible. */
		function matches(query) {
			if (query === "") return true;
			const lower = query.toLowerCase();
			if (NAME.startsWith(lower)) return true;
			return services.translate("label").toLowerCase().includes(lower);
		}

		/** The menu row for the current query, or nothing. */
		function candidates(_session, request) {
			// `/summary` is a whole-line command: a `/` in the middle of a
			// sentence is a file path, not a command.
			if (request?.position !== undefined && request.position !== "leading") return Promise.resolve([]);
			const query = String(request?.query ?? "");
			if (!matches(query)) return Promise.resolve([]);
			const row = {
				name: NAME,
				label: services.translate("label"),
				description: services.translate("description"),
				hint: services.translate("hint"),
				value: NAME
			};
			if (icon !== null) row.icon = icon;
			return Promise.resolve([row]);
		}

		const source = {
			trigger: "/",
			name: NS,
			// Right after the built-in command group (order 0), which keeps the
			// row inside the menu's command block instead of the skills block.
			order: 1,
			// This source contributes one row, not a titled section.
			showGroupTitle: false,
			candidates,
			onPick: (pick) => ({ claim: claimFor(pick.session.sessionId) }),
			matchSpace: (session, token) =>
				String(token).trim().toLowerCase() === `/${NAME}` ? { claim: claimFor(session.sessionId) } : undefined,
			matchEnter: async (session, line, _signal, envelope) => {
				const trimmed = String(line).trim();
				if (!new RegExp(`^/${NAME}(?:\\s|$)`, "u").test(trimmed)) return undefined;
				if ((envelope?.attachments ?? 0) > 0) throw new Error(services.translate("attachments"));
				return { claim: claimFor(session.sessionId) };
			},
			matchClaim: async (session, token) =>
				String(token).trim().toLowerCase() === `/${NAME}` ? { claim: claimFor(session.sessionId) } : undefined
		};

		// ---------------------------------------------------------------------------
		// Module wiring
		// ---------------------------------------------------------------------------
		return {
			inject: ["inputTriggers", "locale"],
			apply(ctx) {
				runtime.ctx = ctx;
				try {
					ctx.locale.register(NS, DICTS);
				} catch {
					// Dictionary registration must never block activation.
				}
				services.locale = ctx.locale ?? null;
				try {
					const bound = ctx.locale.bind(NS);
					services.translate = (key) => {
						try {
							const text = bound(key);
							return typeof text === "string" && text.length > 0 ? text : fallbackTranslate(key);
						} catch {
							return fallbackTranslate(key);
						}
					};
				} catch {
					services.translate = fallbackTranslate;
				}
				const inputTriggers = ctx.get("inputTriggers");
				if (inputTriggers === undefined || typeof inputTriggers.registerSource !== "function") return;
				ctx.effect(
					() => inputTriggers.registerSource(source),
					"summary: slash source"
				);
			}
		};
	}
});
