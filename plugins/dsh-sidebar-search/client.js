/**
 * dsh-sidebar-search — standalone sidebar search for the DeepSeek Harness Web UI.
 *
 * A search trigger beside Settings at the sidebar foot opens a command-palette
 * dialog (registered in the frame-wide `shell.overlay` layer) that searches:
 *
 *   - sessions by message content (Host `sessions.search`) and by title
 *     (the client session list), shown together and de-duplicated;
 *   - projects (workspaces) by title or path;
 *   - quick actions: new session, settings, plugins.
 *
 * Results are grouped and filterable, driven by the keyboard, and styled only
 * with `--dsw-alias-*` theme tokens. Feature originated in dsh-claude-style and
 * is maintained here as an independent plugin.
 */
window.__ModuleLoader__.load({
	id: "dsh-sidebar-search",
	factory(require) {
		const React = require("react");
		const h = React.createElement;
		const { useEffect, useMemo, useRef, useState, useSyncExternalStore } = React;

		const STYLE_SCOPE = "dsh-sidebar-search";

		// ---------------------------------------------------------------------------
		// Locale
		// ---------------------------------------------------------------------------
		const DICTS = {
			en: {
				title: "Search",
				placeholder: "Search conversations, projects…",
				searching: "Searching…",
				empty: "No matching results",
				hint: "Type to search message content, titles, projects and actions.",
				unavailable: "Search is unavailable in this profile.",
				disabled: "Session content search is turned off in this deployment, so message content cannot be searched.",
				failed: "Search failed: {detail}",
				resultsMore: "More matches available — refine the query.",
				filterAll: "All",
				filterSessions: "Sessions",
				filterProjects: "Projects",
				filterActions: "Actions",
				sectionRecents: "Recent sessions",
				sectionSessions: "Sessions",
				sectionProjects: "Projects",
				sectionActions: "Actions",
				actionNewSession: "New session",
				actionSettings: "Settings",
				actionPlugins: "Plugins",
				titleMatch: "Title match",
				justNow: "just now",
				minutesAgo: "{n} min ago",
				hoursAgo: "{n} h ago",
				daysAgo: "{n} d ago",
				enterOpen: "open",
				escClose: "close"
			},
			zh: {
				title: "搜索",
				placeholder: "搜索会话、项目…",
				searching: "正在搜索…",
				empty: "没有匹配的结果",
				hint: "输入关键词，搜索消息内容、会话标题、项目与快捷操作。",
				unavailable: "当前配置下搜索不可用。",
				disabled: "当前部署未启用会话内容索引，无法按消息内容搜索。",
				failed: "搜索失败：{detail}",
				resultsMore: "还有更多匹配，试试更精确的关键词。",
				filterAll: "全部",
				filterSessions: "会话",
				filterProjects: "项目",
				filterActions: "操作",
				sectionRecents: "最近会话",
				sectionSessions: "会话",
				sectionProjects: "项目",
				sectionActions: "操作",
				actionNewSession: "新会话",
				actionSettings: "设置",
				actionPlugins: "插件",
				titleMatch: "标题匹配",
				justNow: "刚刚",
				minutesAgo: "{n} 分钟前",
				hoursAgo: "{n} 小时前",
				daysAgo: "{n} 天前",
				enterOpen: "打开",
				escClose: "关闭"
			}
		};

		function format(template, values) {
			if (!template) return "";
			return String(template).replace(/\{(\w+)\}/gu, (match, key) => (values && values[key] !== undefined ? String(values[key]) : match));
		}

		const fallbackTranslate = (key, values) => format(DICTS.en[key] ?? key, values);

		// ---------------------------------------------------------------------------
		// Services captured at apply() time; components close over this record.
		// ---------------------------------------------------------------------------
		const services = {
			translate: fallbackTranslate,
			sessions: null,
			uiWorkspace: null,
			layout: null
		};

		// ---------------------------------------------------------------------------
		// Dialog open state shared by the trigger and the overlay entry.
		// ---------------------------------------------------------------------------
		let dialogOpen = false;
		const dialogListeners = new Set();
		function setDialogOpen(next) {
			if (dialogOpen === next) return;
			dialogOpen = next;
			for (const listener of [...dialogListeners]) {
				try {
					listener();
				} catch {
					// a broken listener must not break the rest
				}
			}
		}
		function subscribeDialog(listener) {
			dialogListeners.add(listener);
			return () => dialogListeners.delete(listener);
		}
		const getDialogOpen = () => dialogOpen;

		// ---------------------------------------------------------------------------
		// Icons (original artwork, inline)
		// ---------------------------------------------------------------------------
		function iconProps(size) {
			return { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true, style: { flex: "none" } };
		}

		function SearchGlyph({ size }) {
			return h(
				"svg",
				iconProps(size),
				h("circle", { cx: "7", cy: "7", r: "4.6", stroke: "currentColor", "stroke-width": "1.6" }),
				h("path", { d: "M10.6 10.6 14 14", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" })
			);
		}

		function PlusGlyph({ size }) {
			return h("svg", iconProps(size), h("path", { d: "M8 3v10M3 8h10", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" }));
		}

		function GearGlyph({ size }) {
			return h(
				"svg",
				iconProps(size),
				h("circle", { cx: "8", cy: "8", r: "2.4", stroke: "currentColor", "stroke-width": "1.5" }),
				h("path", {
					d: "M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4",
					stroke: "currentColor",
					"stroke-width": "1.5",
					"stroke-linecap": "round"
				})
			);
		}

		function PuzzleGlyph({ size }) {
			return h(
				"svg",
				iconProps(size),
				h("path", {
					d: "M6 2.6a1.4 1.4 0 1 1 2.8 0V4h2.2v2.2h1.4a1.4 1.4 0 1 1 0 2.8H11V13H4.6V9.9H3.2a1.4 1.4 0 1 1 0-2.8H4.6V4H6V2.6Z",
					stroke: "currentColor",
					"stroke-width": "1.3",
					"stroke-linejoin": "round"
				})
			);
		}

		function ChatGlyph({ size }) {
			return h(
				"svg",
				iconProps(size),
				h("path", {
					d: "M2.4 4.2c0-.9.7-1.6 1.6-1.6h8c.9 0 1.6.7 1.6 1.6v5.2c0 .9-.7 1.6-1.6 1.6H7.2L4 13.2v-2.2h-.0c-.9 0-1.6-.7-1.6-1.6V4.2Z",
					stroke: "currentColor",
					"stroke-width": "1.3",
					"stroke-linejoin": "round"
				})
			);
		}

		function FolderGlyph({ size }) {
			return h(
				"svg",
				iconProps(size),
				h("path", {
					d: "M1.9 4.4c0-.6.5-1.1 1.1-1.1h3l1.3 1.5h5.7c.6 0 1.1.5 1.1 1.1v5.6c0 .6-.5 1.1-1.1 1.1H3c-.6 0-1.1-.5-1.1-1.1V4.4Z",
					stroke: "currentColor",
					"stroke-width": "1.3",
					"stroke-linejoin": "round"
				})
			);
		}

		// ---------------------------------------------------------------------------
		// Stylesheet — rendered once by the always-mounted trigger entry.
		// ---------------------------------------------------------------------------
		function Stylesheet() {
			return h("style", null, [
				`.${STYLE_SCOPE}-trigger{`,
				"display:flex;align-items:center;gap:8px;border:1px solid var(--dsw-alias-border-l1);",
				"background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;",
				"font:inherit;border-radius:8px;transition:color .12s ease,background .12s ease;",
				"}",
				`.${STYLE_SCOPE}-trigger:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);}`,
				`.${STYLE_SCOPE}-trigger-wide{width:calc(100% - 16px);margin:0 8px 6px;padding:5px 10px;font-size:13px;text-align:left;}`,
				`.${STYLE_SCOPE}-trigger-rail{width:34px;height:34px;margin:0 auto 6px;padding:0;justify-content:center;}`,
				`.${STYLE_SCOPE}-layer{position:fixed;inset:0;pointer-events:none;z-index:1000;}`,
				`.${STYLE_SCOPE}-backdrop{position:absolute;inset:0;pointer-events:auto;background:transparent;}`,
				`.${STYLE_SCOPE}-panel{position:absolute;left:50%;top:10vh;transform:translateX(-50%);`,
				"width:min(660px,calc(100vw - 48px));max-height:min(560px,74vh);display:flex;flex-direction:column;",
				"pointer-events:auto;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);",
				"border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.16);}",
				`.${STYLE_SCOPE}-inputrow{display:flex;align-items:center;gap:10px;padding:12px 14px;color:var(--dsw-alias-label-secondary);}`,
				`.${STYLE_SCOPE}-input{flex:1;border:none;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;min-width:0;}`,
				`.${STYLE_SCOPE}-input::placeholder{color:var(--dsw-alias-label-secondary);}`,
				`.${STYLE_SCOPE}-kbd{flex:none;font:inherit;font-size:11px;line-height:1;padding:3px 6px;border-radius:5px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);}`,
				`.${STYLE_SCOPE}-tabs{display:flex;gap:4px;padding:0 12px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap;}`,
				`.${STYLE_SCOPE}-tab{border:none;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;`,
				"padding:4px 9px;border-radius:999px;cursor:pointer;}",
				`.${STYLE_SCOPE}-tab:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}`,
				`.${STYLE_SCOPE}-tab[data-active="true"]{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-weight:600;}`,
				`.${STYLE_SCOPE}-body{overflow-y:auto;padding:6px 6px 8px;}`,
				`.${STYLE_SCOPE}-group{margin-top:4px;}`,
				`.${STYLE_SCOPE}-grouphead{display:flex;align-items:center;gap:6px;padding:6px 12px 4px;font-size:11px;letter-spacing:.02em;`,
				"text-transform:uppercase;color:var(--dsw-alias-label-secondary);}",
				`.${STYLE_SCOPE}-note{padding:18px 14px;font-size:13px;color:var(--dsw-alias-label-secondary);text-align:center;}`,
				`.${STYLE_SCOPE}-note-error{color:var(--dsw-alias-state-error-primary);}`,
				`.${STYLE_SCOPE}-row{display:flex;align-items:flex-start;gap:10px;width:100%;padding:8px 12px;border:none;`,
				"background:transparent;font:inherit;text-align:left;border-radius:8px;cursor:pointer;color:var(--dsw-alias-label-primary);}",
				`.${STYLE_SCOPE}-row[data-selected="true"],.${STYLE_SCOPE}-row:hover{background:var(--dsw-alias-bg-layer-2);}`,
				`.${STYLE_SCOPE}-rowicon{flex:none;margin-top:1px;color:var(--dsw-alias-label-secondary);}`,
				`.${STYLE_SCOPE}-rowmain{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;}`,
				`.${STYLE_SCOPE}-rowtop{display:flex;align-items:baseline;gap:8px;min-width:0;}`,
				`.${STYLE_SCOPE}-rowtitle{flex:1;min-width:0;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}`,
				`.${STYLE_SCOPE}-rowtime{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);}`,
				`.${STYLE_SCOPE}-rowsub{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;`,
				"font-size:12px;line-height:1.45;color:var(--dsw-alias-label-secondary);}",
				`.${STYLE_SCOPE}-mark{background:transparent;color:var(--dsw-alias-brand-primary);font-weight:700;padding:0;}`,
				`.${STYLE_SCOPE}-badge{flex:none;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);}`,
				`.${STYLE_SCOPE}-footer{display:flex;gap:14px;align-items:center;padding:8px 14px;border-top:1px solid var(--dsw-alias-border-l1);`,
				"font-size:11px;color:var(--dsw-alias-label-secondary);}"
			].join(""));
		}

		// ---------------------------------------------------------------------------
		// Helpers
		// ---------------------------------------------------------------------------
		const EMPTY_LIST = { ids: [], byId: {}, phase: "pending" };
		const nullSubscribe = () => () => {};
		const FILTERS = [
			{ id: "all", labelKey: "filterAll" },
			{ id: "sessions", labelKey: "filterSessions" },
			{ id: "projects", labelKey: "filterProjects" },
			{ id: "actions", labelKey: "filterActions" }
		];
		const ACTION_DEFS = [
			{ id: "new-session", labelKey: "actionNewSession", Glyph: PlusGlyph, run: () => services.uiWorkspace && services.uiWorkspace.startSession() },
			{ id: "settings", labelKey: "actionSettings", Glyph: GearGlyph, run: () => services.layout && services.layout.selectPanel("settings") },
			{ id: "plugins", labelKey: "actionPlugins", Glyph: PuzzleGlyph, run: () => services.layout && services.layout.selectPanel("plugins") }
		];

		function relativeTime(timestamp, translate) {
			const delta = Date.now() - timestamp;
			if (!(delta >= 0)) return null;
			const minutes = Math.floor(delta / 60000);
			if (minutes < 1) return translate("justNow");
			if (minutes < 60) return translate("minutesAgo", { n: minutes });
			const hours = Math.floor(minutes / 60);
			if (hours < 24) return translate("hoursAgo", { n: hours });
			return translate("daysAgo", { n: Math.floor(hours / 24) });
		}

		function titleOf(listSnapshot, sessionId) {
			const summary = listSnapshot && listSnapshot.byId ? listSnapshot.byId[sessionId] : null;
			if (summary) {
				if (typeof summary.title === "string" && summary.title.trim() !== "") return summary.title;
				if (typeof summary.name === "string" && summary.name.trim() !== "") return summary.name;
			}
			return String(sessionId);
		}

		function timeOf(listSnapshot, sessionId) {
			const summary = listSnapshot && listSnapshot.byId ? listSnapshot.byId[sessionId] : null;
			if (!summary) return null;
			const raw = summary.time ?? summary.updatedAt ?? summary.lastEventTime ?? summary.createdAt;
			return typeof raw === "number" && raw > 0 ? raw : null;
		}

		function lastSegment(path) {
			if (typeof path !== "string" || path.length === 0) return "";
			const parts = path.split(/[\\/]+/u).filter((part) => part.length > 0);
			return parts.length > 0 ? parts[parts.length - 1] : path;
		}

		/** Read the workspace list out of whatever snapshot shape the hook yields. */
		function workspaceEntries(snapshot) {
			if (!snapshot) return [];
			if (Array.isArray(snapshot)) {
				return snapshot.map((entry) => workspaceEntry(entry)).filter((entry) => entry !== null);
			}
			const byId = snapshot.byId && typeof snapshot.byId === "object" ? snapshot.byId : {};
			const ids = Array.isArray(snapshot.ids) ? snapshot.ids : Object.keys(byId);
			const entries = [];
			for (const id of ids) {
				const entry = workspaceEntry(byId[id] ?? { id });
				if (entry !== null) entries.push(entry);
			}
			return entries;
		}

		function workspaceEntry(raw) {
			if (raw === null || typeof raw !== "object") return null;
			const id = raw.id ?? raw.workspaceId;
			if (id === undefined || id === null) return null;
			const path = typeof raw.path === "string" ? raw.path : "";
			const title = typeof raw.title === "string" && raw.title.trim() !== "" ? raw.title : lastSegment(path) || String(id);
			return { kind: "project", workspaceId: id, title, path };
		}

		/** Split a snippet around the earliest query-word match for highlighting. */
		function highlightParts(snippet, query) {
			const words = query.trim().split(/\s+/u).filter((word) => word.length > 0);
			if (words.length === 0) return [snippet];
			const lowered = snippet.toLowerCase();
			let index = -1;
			let length = 0;
			for (const word of words) {
				const at = lowered.indexOf(word.toLowerCase());
				if (at >= 0 && (index < 0 || at < index)) {
					index = at;
					length = word.length;
				}
			}
			if (index < 0) return [snippet];
			return [snippet.slice(0, index), { match: snippet.slice(index, index + length) }, snippet.slice(index + length)];
		}

		/** Turn a Host search failure into a message the reader can act on. */
		function describeSearchFailure(detail, translate) {
			const text = String(detail ?? "");
			if (/search is disabled/i.test(text) || /SESSION_QUERY_DISABLED/i.test(text)) return translate("disabled");
			return translate("failed", { detail: text });
		}

		function buildSessions(query, listSnapshot, contentItems) {
			const byId = new Map();
			if (query !== "") {
				for (const hit of contentItems) {
					if (!hit || hit.sessionId === undefined) continue;
					byId.set(hit.sessionId, {
						kind: "session",
						sessionId: hit.sessionId,
						snippet: typeof hit.snippet === "string" ? hit.snippet : "",
						titleHit: false
					});
				}
				const all = listSnapshot && listSnapshot.byId ? listSnapshot.byId : {};
				for (const id of Object.keys(all)) {
					const title = titleOf(listSnapshot, id);
					if (title === "" || title.toLowerCase().indexOf(query) < 0) continue;
					const found = byId.get(id);
					if (found !== undefined) found.titleHit = true;
					else byId.set(id, { kind: "session", sessionId: id, snippet: "", titleHit: true });
				}
			} else {
				const ids = listSnapshot && Array.isArray(listSnapshot.ids) ? [...listSnapshot.ids] : Object.keys((listSnapshot && listSnapshot.byId) || {});
				ids.sort((a, b) => (timeOf(listSnapshot, b) || 0) - (timeOf(listSnapshot, a) || 0));
				for (const id of ids.slice(0, 6)) byId.set(id, { kind: "session", sessionId: id, snippet: "", titleHit: false });
			}
			const items = [...byId.values()].map((item) => ({
				...item,
				title: titleOf(listSnapshot, item.sessionId),
				time: timeOf(listSnapshot, item.sessionId)
			}));
			items.sort((a, b) => (b.time || 0) - (a.time || 0));
			return query === "" ? items.slice(0, 6) : items.slice(0, 12);
		}

		function buildProjects(query, workspaceSnapshot) {
			const all = workspaceEntries(workspaceSnapshot);
			const matched = query === "" ? all : all.filter((entry) => entry.title.toLowerCase().indexOf(query) >= 0 || entry.path.toLowerCase().indexOf(query) >= 0);
			return matched.slice(0, query === "" ? 5 : 8);
		}

		// ---------------------------------------------------------------------------
		// Sidebar foot trigger
		// ---------------------------------------------------------------------------
		function SearchTrigger(props) {
			const wide = props && props.wide !== false;
			const label = services.translate("title");
			return h(
				React.Fragment,
				null,
				h(Stylesheet, null),
				h(
					"button",
					{
						type: "button",
						className: `${STYLE_SCOPE}-trigger ${wide ? `${STYLE_SCOPE}-trigger-wide` : `${STYLE_SCOPE}-trigger-rail`}`,
						"aria-haspopup": "dialog",
						"aria-label": label,
						title: label,
						onClick: () => setDialogOpen(true)
					},
					h(SearchGlyph, { size: 16 }),
					wide ? h("span", null, label) : null
				)
			);
		}

		// ---------------------------------------------------------------------------
		// Search palette in the frame-wide overlay layer
		// ---------------------------------------------------------------------------
		function SearchDialog(props) {
			const open = useSyncExternalStore(subscribeDialog, getDialogOpen);
			const [query, setQuery] = useState("");
			const [filter, setFilter] = useState("all");
			const [status, setStatus] = useState({ phase: "idle", items: [], hasMore: false, error: null });
			const [selected, setSelected] = useState(0);
			const inputRef = useRef(null);
			const bodyRef = useRef(null);

			const translate = services.translate;
			const sessions = services.sessions;
			const uiWorkspace = services.uiWorkspace;

			const listSubscribe = useMemo(() => (sessions ? (listener) => sessions.list.subscribe(listener) : nullSubscribe), [sessions]);
			const listSnapshot = useSyncExternalStore(listSubscribe, () => (sessions ? sessions.list.getSnapshot() : EMPTY_LIST));

			// Slot-provided selector hook; the fallback keeps a plain snapshot shape.
			const useWorkspaces = typeof props?.useWorkspaces === "function" ? props.useWorkspaces : (selector) => selector(null);
			const workspaceSnapshot = useWorkspaces((snapshot) => snapshot);

			// Reset, focus, and observe Escape whenever the dialog opens.
			useEffect(() => {
				if (!open) return;
				setQuery("");
				setFilter("all");
				setSelected(0);
				setStatus({ phase: "idle", items: [], hasMore: false, error: null });
				const frame = requestAnimationFrame(() => {
					const input = inputRef.current;
					if (input && typeof input.focus === "function") input.focus();
				});
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						event.stopPropagation();
						setDialogOpen(false);
					}
				};
				document.addEventListener("keydown", onKeyDown, true);
				return () => {
					cancelAnimationFrame(frame);
					document.removeEventListener("keydown", onKeyDown, true);
				};
			}, [open]);

			// Debounced content search through the sessions service.
			useEffect(() => {
				if (!open || !sessions) return undefined;
				const trimmed = query.trim();
				if (trimmed.length === 0) {
					setStatus({ phase: "idle", items: [], hasMore: false, error: null });
					return undefined;
				}
				const controller = typeof AbortController === "function" ? new AbortController() : null;
				const timer = setTimeout(() => {
					setStatus((previous) => ({ ...previous, phase: "loading", error: null }));
					Promise.resolve()
						.then(() => sessions.search(trimmed, controller ? controller.signal : undefined))
						.then((result) => {
							if (controller && controller.signal.aborted) return;
							if (result && result.ok === true) {
								setStatus({
									phase: "done",
									items: Array.isArray(result.value?.items) ? result.value.items : [],
									hasMore: result.value?.hasMore === true,
									error: null
								});
							} else {
								const detail = (result && result.error && result.error.message) || "unknown error";
								setStatus({ phase: "error", items: [], hasMore: false, error: describeSearchFailure(detail, translate) });
							}
						})
						.catch((error) => {
							if (controller && controller.signal.aborted) return;
							setStatus({ phase: "error", items: [], hasMore: false, error: describeSearchFailure(error?.message ?? String(error), translate) });
						});
				}, 180);
				return () => {
					clearTimeout(timer);
					if (controller) controller.abort();
				};
			}, [query, open, sessions, translate]);

			// One ordered, filter-aware group list drives both rendering and keys.
			const groups = useMemo(() => {
				const q = query.trim().toLowerCase();
				const out = [];
				const push = (key, items) => {
					if (items.length === 0) return;
					if (filter !== "all" && filter !== key) return;
					out.push({ key, items });
				};
				const actionItems =
					q === ""
						? ACTION_DEFS.map((def) => ({ kind: "action", key: def.id, def }))
						: ACTION_DEFS.filter((def) => translate(def.labelKey).toLowerCase().indexOf(q) >= 0).map((def) => ({ kind: "action", key: def.id, def }));
				const sessionItems = buildSessions(q, listSnapshot, status.items);
				const projectItems = buildProjects(q, workspaceSnapshot);
				if (q === "") {
					push("actions", actionItems);
					push("sessions", sessionItems);
					push("projects", projectItems);
				} else {
					push("sessions", sessionItems);
					push("projects", projectItems);
					push("actions", actionItems);
				}
				return out;
			}, [query, filter, status.items, listSnapshot, workspaceSnapshot, translate]);

			const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

			// Keep the keyboard selection inside the current result list.
			useEffect(() => {
				setSelected((current) => Math.min(current, Math.max(flat.length - 1, 0)));
			}, [flat.length]);

			// Scroll the selected row into view.
			useEffect(() => {
				const body = bodyRef.current;
				if (!body) return;
				const node = body.querySelector('[data-selected="true"]');
				if (node && typeof node.scrollIntoView === "function") node.scrollIntoView({ block: "nearest" });
			}, [selected, flat.length]);

			if (!open) return null;

			function runItem(item) {
				try {
					if (item.kind === "action") item.def.run();
					else if (item.kind === "session" && uiWorkspace && typeof uiWorkspace.openSession === "function") uiWorkspace.openSession(item.sessionId);
					else if (item.kind === "project" && uiWorkspace && typeof uiWorkspace.openWorkspace === "function") {
						const opened = uiWorkspace.openWorkspace(item.workspaceId);
						if (opened && typeof opened.catch === "function") opened.catch(() => {});
					}
				} catch {
					// navigation failures surface through the host's own notices
				}
				setDialogOpen(false);
			}

			function onKeyDown(event) {
				if (event.key === "ArrowDown") {
					event.preventDefault();
					setSelected((current) => Math.min(current + 1, Math.max(flat.length - 1, 0)));
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					setSelected((current) => Math.max(current - 1, 0));
				} else if (event.key === "Enter") {
					event.preventDefault();
					const item = flat[selected];
					if (item) runItem(item);
				}
			}

			function renderHighlighted(text, q, className) {
				return h(
					className,
					null,
					highlightParts(String(text ?? ""), q).map((part, index) =>
						part && typeof part === "object" && part.match !== undefined ? h("mark", { key: index, className: `${STYLE_SCOPE}-mark` }, part.match) : String(part)
					)
				);
			}

			function renderRow(item, index) {
				const selectedRow = index === selected;
				let glyph = null;
				let top = null;
				let sub = null;
				if (item.kind === "action") {
					glyph = h(item.def.Glyph, { size: 15 });
					top = h("span", { className: `${STYLE_SCOPE}-rowtitle`, style: { fontWeight: 500 } }, translate(item.def.labelKey));
				} else if (item.kind === "session") {
					glyph = h(ChatGlyph, { size: 15 });
					top = h(
						React.Fragment,
						null,
						renderHighlighted(item.title, query, `${STYLE_SCOPE}-rowtitle`),
						item.time !== null && item.time !== undefined
							? h("span", { className: `${STYLE_SCOPE}-rowtime` }, relativeTime(item.time, translate))
							: null,
						item.titleHit && item.snippet !== ""
							? h("span", { className: `${STYLE_SCOPE}-badge` }, translate("titleMatch"))
							: null
					);
					if (item.snippet !== "") {
						sub = h(
							"span",
							{ className: `${STYLE_SCOPE}-rowsub` },
							highlightParts(item.snippet, query).map((part, partIndex) =>
								part && typeof part === "object" && part.match !== undefined
									? h("mark", { key: partIndex, className: `${STYLE_SCOPE}-mark` }, part.match)
									: String(part)
							)
						);
					}
				} else {
					glyph = h(FolderGlyph, { size: 15 });
					top = h(
						React.Fragment,
						null,
						renderHighlighted(item.title, query, `${STYLE_SCOPE}-rowtitle`),
						item.path !== "" ? h("span", { className: `${STYLE_SCOPE}-rowtime` }, item.path) : null
					);
				}
				return h(
					"button",
					{
						key: `${item.kind}:${item.key ?? item.sessionId ?? item.workspaceId}`,
						type: "button",
						className: `${STYLE_SCOPE}-row`,
						"data-selected": selectedRow ? "true" : "false",
						onMouseMove: () => setSelected(index),
						onClick: () => runItem(item)
					},
					h("span", { className: `${STYLE_SCOPE}-rowicon` }, glyph),
					h("span", { className: `${STYLE_SCOPE}-rowmain` }, h("span", { className: `${STYLE_SCOPE}-rowtop` }, top), sub)
				);
			}

			const sectionLabel = (key) => {
				if (key === "sessions") return translate(query.trim() === "" ? "sectionRecents" : "sectionSessions");
				if (key === "projects") return translate("sectionProjects");
				return translate("sectionActions");
			};

			let index = 0;
			const rendered = [];
			for (const group of groups) {
				rendered.push(
					h("div", { key: `head:${group.key}`, className: `${STYLE_SCOPE}-grouphead` }, sectionLabel(group.key), h("span", null, String(group.items.length)))
				);
				for (const item of group.items) {
					rendered.push(renderRow(item, index));
					index += 1;
				}
			}

			let notice = null;
			if (!sessions) notice = h("div", { className: `${STYLE_SCOPE}-note` }, translate("unavailable"));
			else if (status.phase === "error") notice = h("div", { className: `${STYLE_SCOPE}-note ${STYLE_SCOPE}-note-error` }, status.error ?? "");
			else if (query.trim() === "" && flat.length === 0) notice = h("div", { className: `${STYLE_SCOPE}-note` }, translate("hint"));
			else if (query.trim() !== "" && flat.length === 0 && status.phase === "loading") notice = h("div", { className: `${STYLE_SCOPE}-note` }, translate("searching"));
			else if (query.trim() !== "" && flat.length === 0 && status.phase === "done")
				notice = h("div", { className: `${STYLE_SCOPE}-note` }, translate("empty"));

			return h(
				"div",
				{ className: `${STYLE_SCOPE}-layer`, role: "presentation" },
				h("div", { className: `${STYLE_SCOPE}-backdrop`, onMouseDown: () => setDialogOpen(false) }),
				h(
					"div",
					{ className: `${STYLE_SCOPE}-panel`, role: "dialog", "aria-label": translate("title"), onKeyDown },
					h(
						"div",
						{ className: `${STYLE_SCOPE}-inputrow` },
						h(SearchGlyph, { size: 15 }),
						h("input", {
							ref: inputRef,
							className: `${STYLE_SCOPE}-input`,
							type: "text",
							value: query,
							placeholder: translate("placeholder"),
							spellCheck: false,
							onChange: (event) => setQuery(event.currentTarget.value)
						}),
						h("span", { className: `${STYLE_SCOPE}-kbd` }, "Esc")
					),
					h(
						"div",
						{ className: `${STYLE_SCOPE}-tabs`, role: "tablist" },
						FILTERS.map((entry) =>
							h(
								"button",
								{
									key: entry.id,
									type: "button",
									role: "tab",
									"aria-selected": filter === entry.id ? "true" : "false",
									"data-active": filter === entry.id ? "true" : "false",
									className: `${STYLE_SCOPE}-tab`,
									onClick: () => {
										setFilter(entry.id);
										setSelected(0);
									}
								},
								translate(entry.labelKey)
							)
						)
					),
					h("div", { className: `${STYLE_SCOPE}-body`, ref: bodyRef }, notice, rendered),
					query.trim() !== ""
						? h(
								"div",
								{ className: `${STYLE_SCOPE}-footer` },
								h("span", null, "↑↓ ", translate("enterOpen")),
								h("span", null, "↵ ", translate("enterOpen")),
								h("span", null, "Esc ", translate("escClose")),
								status.hasMore ? h("span", null, translate("resultsMore")) : null
							)
						: null
				)
			);
		}

		// ---------------------------------------------------------------------------
		// Module wiring
		// ---------------------------------------------------------------------------
		return {
			inject: ["slots", "locale", "sessions", "uiWorkspace"],
			apply(ctx) {
				const locale = ctx.get("locale");
				if (locale) {
					try {
						if (typeof locale.register === "function") locale.register(STYLE_SCOPE, DICTS);
					} catch {
						// dictionary registration must never block activation
					}
					try {
						if (typeof locale.bind === "function") {
							const bound = locale.bind(STYLE_SCOPE);
							services.translate = (key, values) => {
								try {
									const text = bound(key, values);
									return typeof text === "string" && text.length > 0 ? text : fallbackTranslate(key, values);
								} catch {
									return fallbackTranslate(key, values);
								}
							};
						}
					} catch {
						services.translate = fallbackTranslate;
					}
				}
				services.sessions = ctx.get("sessions") ?? null;
				services.uiWorkspace = ctx.get("uiWorkspace") ?? null;
				services.layout = ctx.get("layout") ?? null;

				ctx.slots.inject("sidebar.footer.action", () =>
					ctx.slots.register(
						{ name: "sidebar.footer.action", id: "dsh-sidebar-search", order: -10, label: () => services.translate("title") },
						SearchTrigger
					)
				);
				ctx.slots.inject("shell.overlay", () =>
					ctx.slots.register({ name: "shell.overlay", id: "dsh-sidebar-search-dialog", order: 400 }, SearchDialog)
				);
			}
		};
	}
});
