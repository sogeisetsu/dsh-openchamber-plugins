/**
 * dsh-summary-command — the OpenChamber `/summary` magic prompt, ported to
 * DeepSeek Harness as a human slash command.
 *
 * `/summary` (optionally `/summary <topic>`) submits one model-visible user
 * message into the current session through `agent.followup()`, which wakes an
 * idle agent immediately and queues behind a running turn otherwise. The
 * message pairs OpenChamber's visible request with its hidden summary
 * instructions, so the agent answers with a compact, non-destructive summary
 * suitable for handing the work off to a new session.
 *
 * @module dsh-summary-command
 */
import { CommandDefinitionId } from "@deepseek-ai/dsh-commands/brand";
import { createUserMessage } from "@deepseek-ai/dsh-llm";

const name = "summary-command";
const inject = ["commands"];

/**
 * OpenChamber's `session.summary.instructions` magic prompt (packages/ui/src/lib/magicPrompts.ts),
 * ported with its `{{topic_block}}` placeholder intact.
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

/** Execute one `/summary [topic]` invocation by submitting the prompt pair. */
function executeSummary(invocation) {
	const topic = invocation.rawInput.trim();
	if (invocation.attachments.length > 0) {
		return {
			kind: "error",
			text: "Usage: /summary [topic] — attachments are not accepted."
		};
	}
	const message = createUserMessage({
		content: [{ type: "text", text: buildPrompt(topic) }],
		source: { kind: "user" }
	});
	try {
		invocation.agent.followup(message);
	} catch (error) {
		return {
			kind: "error",
			text: `Summary could not be submitted: ${error?.message ?? String(error)}`
		};
	}
	return {
		kind: "success",
		text: topic.length > 0 ? `Summary requested (focus: ${topic}).` : "Summary requested."
	};
}

/** Register the `/summary` human command for the composed command registry. */
function apply(ctx) {
	ctx.commands.register({
		definitionId: CommandDefinitionId("dsh-summary-command"),
		name: "summary",
		description: "Summarize this conversation for hand-off",
		input: {
			hint: "[topic]"
		},
		handler: (invocation) => executeSummary(invocation)
	});
}

export { apply, inject, name };
