import { useEffect, useMemo, useState } from "react"
import { Braces, Check, FileCode2, GitBranch, KeyRound, Play, Save, ShieldCheck, TerminalSquare, X } from "lucide-react"
import { ApiError, WebApi, type FileChange, type Workspace } from "./api"

const defaultApiUrl = import.meta.env.VITE_ADTEC_API_URL ?? "http://localhost:8787"

function DiffPreview({ changes }: { changes: FileChange[] }) {
	if (changes.length === 0) return <div className="empty">保存后的差异会显示在这里</div>
	return (
		<div className="diff-list">
			{changes.flatMap((change) => change.diff.map((line, index) => <div className={`diff-line ${line.type}`} key={`${change.path}-${index}-${line.line}`}><span>{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}</span><code>{line.text || " "}</code></div>))}
		</div>
	)
}

export function App() {
	const [token, setToken] = useState(() => localStorage.getItem("adtec.token") ?? "")
	const [tokenInput, setTokenInput] = useState(token)
	const [apiUrl, setApiUrl] = useState(defaultApiUrl)
	const [workspaces, setWorkspaces] = useState<Workspace[]>([])
	const [workspaceId, setWorkspaceId] = useState("")
	const [filePath, setFilePath] = useState("README.md")
	const [content, setContent] = useState("")
	const [changes, setChanges] = useState<FileChange[]>([])
	const [patch, setPatch] = useState("")
	const [prompt, setPrompt] = useState("")
	const [taskState, setTaskState] = useState("")
	const [notice, setNotice] = useState("准备连接服务")

	const api = useMemo(() => token ? new WebApi(apiUrl.replace(/\/$/, ""), token) : undefined, [apiUrl, token])

	useEffect(() => {
		if (!api) return
		void api.listWorkspaces().then((items) => {
			setWorkspaces(items)
			setWorkspaceId((current) => current || items[0]?.id || "")
			setNotice(items.length ? "已连接" : "没有可访问的工作区")
		}).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "连接失败"))
	}, [api])

	async function connect() {
		localStorage.setItem("adtec.token", tokenInput)
		setToken(tokenInput)
		setNotice("正在连接")
	}

	async function loadFile() {
		if (!api || !workspaceId) return
		try {
			setContent(await api.readFile(workspaceId, filePath))
			setChanges([])
			setNotice(`已读取 ${filePath}`)
		} catch (error) {
			setNotice(error instanceof ApiError ? `${error.status}: ${error.message}` : "读取失败")
		}
	}

	async function saveFile() {
		if (!api || !workspaceId) return
		try {
			setChanges([await api.writeFile(workspaceId, filePath, content)])
			setNotice("文件已保存")
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "保存失败")
		}
	}

	async function applyStructuredPatch() {
		if (!api || !workspaceId || !patch.trim()) return
		try {
			setChanges(await api.applyPatch(workspaceId, patch))
			setNotice("Patch 已应用")
		} catch (error) {
			setNotice(error instanceof Error ? error.message : "Patch 应用失败")
		}
	}

	async function runTask() {
		if (!api || !workspaceId || !prompt.trim()) return
		try {
			const task = await api.createTask(workspaceId, prompt)
			setTaskState(`${task.id}: ${task.status}`)
			const source = api.subscribeTask(task.id, (event) => setTaskState(`${task.id}: ${event.type} ${event.data}`))
			window.setTimeout(() => source.close(), 60_000)
		} catch (error) {
			setTaskState(error instanceof Error ? error.message : "任务创建失败")
		}
	}

	if (!token) return <main className="auth-shell"><div className="auth-panel"><div className="brand-mark"><Braces size={22} /></div><p className="eyebrow">ADTEC CODE / WEB</p><h1>连接你的代码工作区</h1><p className="muted">使用企业身份认证后获得服务会话令牌。</p><label>API 地址<input value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} /></label><label>会话令牌<input type="password" value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void connect()} /></label><button className="primary wide" onClick={() => void connect()}><KeyRound size={16} />连接服务</button><p className="status-line"><ShieldCheck size={15} />服务端负责组织与工作区权限隔离</p></div></main>

	return <main className="app-shell"><header className="topbar"><div className="brand"><div className="brand-mark"><Braces size={18} /></div><div><strong>ADTEC Code</strong><span>Web workspace</span></div></div><div className="top-actions"><span className="connection"><span className="pulse" />{notice}</span><button className="icon-button" title="断开连接" onClick={() => { localStorage.removeItem("adtec.token"); setToken("") }}><X size={17} /></button></div></header><section className="workspace-bar"><div><p className="eyebrow">工作区</p><select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>{workspaces.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div><div className="workspace-meta"><GitBranch size={15} />隔离工作区 · 受权限控制</div></section><div className="content-grid"><section className="editor-panel"><div className="panel-heading"><div className="file-title"><FileCode2 size={17} /><input value={filePath} onChange={(event) => setFilePath(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void loadFile()} /></div><div className="button-row"><button className="secondary" onClick={() => void loadFile()}><TerminalSquare size={15} />读取</button><button className="primary" onClick={() => void saveFile()}><Save size={15} />保存</button></div></div><textarea className="code-editor" value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} placeholder="选择文件并点击读取" /><div className="diff-panel"><div className="panel-heading compact"><span><span className="dot add-dot" /> Diff 预览</span><span className="muted">{changes.reduce((count, item) => count + item.diff.filter((line) => line.type === "add").length, 0)} additions</span></div><DiffPreview changes={changes} /></div></section><aside className="side-column"><section className="tool-panel"><div className="panel-heading compact"><span><Braces size={15} />结构化 Patch</span><span className="muted">apply_patch</span></div><textarea className="patch-editor" value={patch} onChange={(event) => setPatch(event.target.value)} spellCheck={false} placeholder="*** Begin Patch\n*** Update File: README.md\n@@\n-old\n+new\n*** End Patch" /><button className="secondary wide" onClick={() => void applyStructuredPatch()}><Check size={15} />应用 Patch</button></section><section className="tool-panel task-panel"><div className="panel-heading compact"><span><Play size={15} />Agent 任务</span><span className="muted">SSE</span></div><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="描述需要处理的任务" /><button className="primary wide" onClick={() => void runTask()}><Play size={15} />创建任务</button>{taskState && <pre className="task-state">{taskState}</pre>}</section></aside></div></main>
}
