/**
 * dsh-files-show-hidden — a hidden-files toggle in the right Sidebar's files page header.
 *
 * The file browser already knows how to show hidden entries: its search bar
 * carries an eye control ("Show hidden entries") whose choice is saved per
 * workspace root. The files page starts with that search bar collapsed, so the
 * control is easy to miss. This plugin adds a header button that toggles the
 * same setting by invoking the browser's own controls, which keeps one owner of
 * the preference and one persisted value.
 *
 * The plugin reads the documented preference only to show its pressed state; it
 * never writes that value itself. If a future DSH release renames the browser's
 * documented data attributes, the button reports that it is unsupported instead
 * of failing silently.
 *
 * Feature originated in OpenChamber's files view (show hidden / dotfiles).
 */

window.__ModuleLoader__.load({
	id: "dsh-files-show-hidden",
	factory(require) {
		const React = require("react");
		const h = React.createElement;

		const NS = "filesShowHidden";
		const STYLE_SCOPE = "dsh-files-show-hidden";

		/** Browser storage the file browser persists its per-workspace preferences in (documented key). */
		const PREFERENCE_KEY = "dsh.sidebar-files.workspace-search.v1";
		/** The files page container: scopes every lookup to the pane that owns this button. */
		const PAGE_SELECTOR = "[data-files-page]";
		/** The page header's search-bar toggle; its `aria-expanded` tells whether the eye is mounted. */
		const SEARCH_TOGGLE_SELECTOR = "[data-files-search-toggle]";
		/** The browser's own hidden-entry control, inside the search bar. */
		const HIDDEN_TOGGLE_SELECTOR = "[data-files-show-hidden]";

		// ---------------------------------------------------------------------------
		// Locale
		// ---------------------------------------------------------------------------
		const DICTS = {
			en: {
				label: "Hidden files",
				show: "Show hidden files",
				hide: "Hide hidden files",
				unsupported: "This DSH version does not expose the file browser's hidden-files control."
			},
			zh: {
				label: "隐藏文件",
				show: "显示隐藏文件",
				hide: "不再显示隐藏文件",
				unsupported: "当前 DSH 版本没有暴露文件浏览器的隐藏文件开关。"
			}
		};

		const fallbackTranslate = (key) => DICTS.en[key] ?? key;

		/** Services captured at apply() time; components close over this record. */
		const services = {
			translate: fallbackTranslate,
			locale: null
		};

		let warnedMissingControl = false;

		// ---------------------------------------------------------------------------
		// Documented preference (read-only)
		// ---------------------------------------------------------------------------

		/**
		 * The storage key of one workspace root, normalized as the file browser
		 * does it: trailing separators dropped except the one a filesystem root
		 * needs (`/`, `C:\`, `C:/`).
		 */
		function workspaceKey(cwd) {
			const trimmed = cwd.replace(/[/\\]+$/, "");
			if (trimmed === "") return cwd.slice(0, 1);
			if (/^[A-Za-z]:$/.test(trimmed) && cwd.length > trimmed.length) return cwd.slice(0, 3);
			return trimmed;
		}

		/** Whether the reader's saved choice shows hidden entries for this workspace root. */
		function readShowHidden(cwd) {
			if (typeof cwd !== "string" || cwd === "" || typeof localStorage === "undefined") return false;
			try {
				const raw = localStorage.getItem(PREFERENCE_KEY);
				if (raw === null) return false;
				const parsed = JSON.parse(raw);
				if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return false;
				const key = workspaceKey(cwd);
				if (!Object.prototype.hasOwnProperty.call(parsed, key)) return false;
				const entry = parsed[key];
				return typeof entry === "object" && entry !== null && entry.showHidden === true;
			} catch {
				return false;
			}
		}

		// ---------------------------------------------------------------------------
		// The built-in controls (looked up inside this pane's files page)
		// ---------------------------------------------------------------------------

		/** The page that owns this button, so two docked panes never drive each other. */
		function pageScopeOf(button) {
			const closest = button && typeof button.closest === "function" ? button.closest(PAGE_SELECTOR) : null;
			if (closest) return closest;
			const pages = typeof document === "undefined" ? [] : document.querySelectorAll(PAGE_SELECTOR);
			return pages.length === 1 ? pages[0] : null;
		}

		function sleep(ms) {
			return new Promise((resolve) => { setTimeout(resolve, ms); });
		}

		/** Wait for a control the browser mounts on the next commit. */
		async function waitFor(scope, selector, attempts, stepMs) {
			for (let i = 0; i < attempts; i += 1) {
				const found = scope.querySelector(selector);
				if (found) return found;
				await sleep(stepMs);
			}
			return null;
		}

		// ---------------------------------------------------------------------------
		// Icons (original artwork)
		// ---------------------------------------------------------------------------
		function iconProps() {
			return {
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				focusable: "false",
				style: { display: "block" }
			};
		}

		function EyeGlyph() {
			return h(
				"svg",
				iconProps(),
				h("path", {
					d: "M1.6 8s2.4-3.9 6.4-3.9S14.4 8 14.4 8s-2.4 3.9-6.4 3.9S1.6 8 1.6 8Z",
					stroke: "currentColor",
					"stroke-width": "1.3",
					"stroke-linejoin": "round"
				}),
				h("circle", { cx: "8", cy: "8", r: "2.2", stroke: "currentColor", "stroke-width": "1.3" })
			);
		}

		function EyeOffGlyph() {
			return h(
				"svg",
				iconProps(),
				h("path", {
					d: "M1.6 8s2.4-3.9 6.4-3.9S14.4 8 14.4 8s-2.4 3.9-6.4 3.9S1.6 8 1.6 8Z",
					stroke: "currentColor",
					"stroke-width": "1.3",
					"stroke-linejoin": "round",
					opacity: "0.55"
				}),
				h("path", { d: "M2.6 13.4 13.4 2.6", stroke: "currentColor", "stroke-width": "1.4", "stroke-linecap": "round" })
			);
		}

		// ---------------------------------------------------------------------------
		// Styles, matching the files page header's 28px tool button
		// ---------------------------------------------------------------------------
		const STYLES = [
			`.${STYLE_SCOPE}-tool{`,
			"display:inline-flex;flex:none;align-items:center;justify-content:center;",
			"width:28px;height:28px;padding:6px;color:var(--dsw-alias-label-secondary);",
			"line-height:1;background:transparent;border:none;border-radius:var(--dsw-radius-sm);cursor:pointer;",
			"}",
			`.${STYLE_SCOPE}-tool svg{width:15px;height:15px;}`,
			"@media (hover:hover){",
			`.${STYLE_SCOPE}-tool:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);}`,
			"}",
			`.${STYLE_SCOPE}-tool[aria-pressed='true']{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);}`,
			`.${STYLE_SCOPE}-tool:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}`,
			`.${STYLE_SCOPE}-tool[data-unsupported='true']{opacity:.55;}`
		].join("");

		// ---------------------------------------------------------------------------
		// The header toggle
		// ---------------------------------------------------------------------------
		function HiddenFilesToggle(props) {
			const { absolutePath } = props;
			const t = services.translate;
			const [showHidden, setShowHidden] = React.useState(() => readShowHidden(absolutePath));
			const [unsupported, setUnsupported] = React.useState(false);
			const buttonRef = React.useRef(null);
			const busyRef = React.useRef(false);
			const aliveRef = React.useRef(true);
			const [, forceLocaleRender] = React.useReducer((value) => value + 1, 0);

			React.useEffect(() => () => { aliveRef.current = false; }, []);

			// Re-read the saved choice when the page switches to another workspace.
			React.useEffect(() => {
				setShowHidden(readShowHidden(absolutePath));
				setUnsupported(false);
			}, [absolutePath]);

			// Re-render labels when the reader switches language.
			React.useEffect(() => {
				const locale = services.locale;
				if (!locale || typeof locale.subscribe !== "function") return undefined;
				return locale.subscribe(forceLocaleRender);
			}, []);

			// Keep the pressed state in step with the browser's own eye, including
			// when the reader clicks that eye directly.
			React.useEffect(() => {
				const scope = pageScopeOf(buttonRef.current);
				if (!scope || typeof MutationObserver === "undefined") return undefined;
				const observer = new MutationObserver((records) => {
					for (const record of records) {
						const target = record.target;
						if (!target || typeof target.matches !== "function" || !target.matches(HIDDEN_TOGGLE_SELECTOR)) continue;
						setShowHidden(target.getAttribute("aria-pressed") === "true");
						setUnsupported(false);
					}
				});
				observer.observe(scope, { subtree: true, attributes: true, attributeFilter: ["aria-pressed"] });
				return () => { observer.disconnect(); };
			}, [absolutePath]);

			const fail = () => {
				if (!aliveRef.current) return;
				setUnsupported(true);
				if (!warnedMissingControl) {
					warnedMissingControl = true;
					console.warn("[dsh-files-show-hidden] could not find the file browser's hidden-files control; the toggle is unsupported in this DSH build.");
				}
			};

			const toggle = async () => {
				if (busyRef.current) return;
				const button = buttonRef.current;
				const scope = pageScopeOf(button);
				if (!scope) {
					fail();
					return;
				}
				busyRef.current = true;
				try {
					const searchToggle = scope.querySelector(SEARCH_TOGGLE_SELECTOR);
					if (searchToggle && searchToggle.getAttribute("aria-expanded") !== "true" && typeof searchToggle.click === "function") {
						searchToggle.click();
					}
					const eye = await waitFor(scope, HIDDEN_TOGGLE_SELECTOR, 24, 25);
					if (!eye) {
						fail();
						return;
					}
					const wasShown = eye.getAttribute("aria-pressed") === "true";
					if (typeof eye.click === "function") eye.click();
					if (!aliveRef.current) return;
					setShowHidden(!wasShown);
					setUnsupported(false);
					if (button && typeof button.focus === "function") {
						try { button.focus({ preventScroll: true }); } catch { button.focus(); }
					}
				} finally {
					busyRef.current = false;
				}
			};

			const title = unsupported ? t("unsupported") : showHidden ? t("hide") : t("show");
			return h(
				React.Fragment,
				null,
				h("style", null, STYLES),
				h(
					"button",
					{
						ref: buttonRef,
						type: "button",
						className: `${STYLE_SCOPE}-tool`,
						"aria-label": t("label"),
						"aria-pressed": showHidden ? "true" : "false",
						"data-unsupported": unsupported ? "true" : "false",
						title,
						onClick: toggle
					},
					showHidden ? h(EyeGlyph) : h(EyeOffGlyph)
				)
			);
		}

		// ---------------------------------------------------------------------------
		// Module wiring
		// ---------------------------------------------------------------------------
		return {
			inject: ["slots", "locale"],
			apply(ctx) {
				try {
					ctx.locale.register(NS, DICTS);
				} catch {
					// dictionary registration must never block activation
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
				ctx.slots.inject("sidebar.right.tab.files.actions", () =>
					ctx.slots.register(
						{
							name: "sidebar.right.tab.files.actions",
							id: "files-show-hidden",
							order: -10,
							label: () => services.translate("label")
						},
						HiddenFilesToggle
					)
				);
			}
		};
	}
});
