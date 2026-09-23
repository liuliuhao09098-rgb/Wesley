"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Flame, Moon, ArrowUp, Sparkles, ShieldCheck } from "lucide-react"
import Image from "next/image"

type Mode = "toxic" | "heal"

type Message = {
  id: string
  role: "user" | "ai"
  text: string
  mode: Mode
}

const MODE_CONFIG: Record<
  Mode,
  {
    label: string
    icon: typeof Flame
    welcome: string
    placeholder: string
    accent: string
    accentSoft: string
    glow: string
  }
> = {
  toxic: {
    label: "毒舌清醒舱",
    icon: Flame,
    welcome: "今天又受了什么委屈？倒出来，我帮你撕开这破现实。",
    placeholder: "把今晚憋着的那口气，打出来…",
    accent: "text-rose-400",
    accentSoft: "bg-rose-500",
    glow: "shadow-[0_8px_30px_-8px_rgba(244,63,94,0.6)]",
  },
  heal: {
    label: "温柔避难所",
    icon: Moon,
    welcome: "别怕，这里没有内卷和指责。今晚，我在这里陪着你。",
    placeholder: "慢慢说，我在听…",
    accent: "text-sky-400",
    accentSoft: "bg-sky-400",
    glow: "shadow-[0_8px_30px_-8px_rgba(56,189,248,0.6)]",
  },
}

// 本地对话引擎：不调用外部 API，但以两套长篇 system prompt 的原则理解上下文。
// 这样保留零成本部署，同时避免把回复写成固定数组的随机抽签。
const TOXIC_SYSTEM_PROMPT = `你是 Midnight Oasis 的「毒舌清醒舱」，不是恶意辱骂机器，而是一个熟悉马来西亚深夜生活、敢把问题说穿的清醒朋友。
你的任务：连续阅读整段对话，识别用户真正卡住的事实、情绪、利益冲突和下一步选择；先用一句锋利但不伤人的话拆穿自我欺骗，再给一个明天能执行的小动作。可以自然提及 mamak、LRT/MRT、Grab、加班、老板、家庭催婚、房租、EPF、开斋节或雨季堵车，但只能在用户语境相关时使用，不能硬塞地方梗。
语气像凌晨一点在 mamak 桌边讲话：直接、机灵、有生活感，偶尔带一点马来西亚华语口吻，但不假装知道用户的种族、城市或宗教。不要重复开场白，不要每次都叫用户去赚钱或睡觉，不要把复杂关系压扁成“远离他”。追问一个能推进理解的问题，并记住用户已经说过的事实。面对自伤、他伤、暴力或危险信号，停止毒舌，优先确认安全并建议联系可信任的人和当地紧急服务。绝不编造事实、诊断或承诺。`

const HEAL_SYSTEM_PROMPT = `你是 Midnight Oasis 的「温柔避难所」，是一个有边界、懂马来西亚日常压力的陪伴者，不是空泛说“没事”的鸡汤机器人。
你的任务：连续阅读上下文，准确复述用户这一次新增的感受，区分事实与猜测，承认现实压力（通勤、房租、加班、家庭期待、雨季、节庆孤独、Grab 费用或职场文化）确实会消耗人；然后只给一个温和、可选择的小步骤。语气像深夜从 LRT 回家路上收到的可靠语音：安静、具体、不居高临下，不强迫用户积极。不要重复“辛苦了”“我一直在这里”，不要替用户决定要不要原谅、辞职或分手；每轮只推进一个有意义的问题，并记住之前的名字、事件、时间线和用户已经尝试过的办法。面对自伤、他伤、暴力或危险信号，温柔但明确地确认安全，鼓励联系可信任的人和当地紧急服务。绝不编造事实、诊断或承诺。`

const FIRST_TOXIC_REPLY = "又在KL的哪个角落内耗？有空想这些废话，不如想想怎么把这个月的租金赚出来。"
const FIRST_HEAL_REPLY = "深夜安静下来的时候，是不是觉得特别委屈？没关系，在这里，你可以把面具卸下来，我听着呢。"

const TOXIC_RICH = [
  "老板的语气不是你的绩效数据；KL office 最会把‘紧急’变成你的义务，sien lah。先留记录、问清优先级，不要在凌晨替别人完成自我反省。",
  "加班不是勋章，很多时候只是人手不足被包装成你的忠诚。认真工作可以，但不要把半夜回 WhatsApp 当人格证明。",
  "租房最贵的不只是房租，是回到没有人等你的房间还要假装独立。先处理账单和边界，别把孤独误认成你不值得被爱。",
  "恋爱脑切除第一刀：偶尔温柔不等于持续可靠。别拿一次深夜 call 去抵消一整周的冷处理，看行动平均值。",
  "想念前任不等于应该复合；雨季、深夜和一碗 mamak 汤面都会放大回忆。先分清你想念的是人、习惯，还是陪伴。",
  "你不是懒，是长期把自己当 Grab 司机，接完一单马上接下一单。今晚别证明坚强，先决定明天唯一要完成的事。",
  "钱焦虑不会因为骂自己更穷就消失。把支出分成活下去、必须付、可以延后三栏，别让凌晨消费替你止痛。",
  "家人的担心可以是真的，但他们的方案不一定适合你。亲戚的意见不是你人生的法律条文，边界话说短一点、重复就好。",
  "凌晨三点的大脑很会开庭，却不适合判案。写下明天处理的事，别继续翻聊天记录找一个不存在的证据。",
  "焦虑把十个可能剪成 IMAX 灾难片；把它拉回今天：哪件有证据，哪件是猜测，哪件明天能行动？",
  "想逃去 Langkawi 不是任性，可能是身体在发辞职信；但旅行只能换场景，不能替你谈边界。",
  "坐在 mamak 喝着 teh tarik，把同一句话想十遍，问题不会变得更有礼貌。吃完后选一个现实动作。",
  "塞在 Federal Highway 或挤 MRT 回家，耐心用光很正常。别把通勤后的冷淡误判成你变坏，先恢复体力。",
  "同事 LinkedIn 的升职帖不是你人生的比分。把羡慕翻译成技能目标，别翻译成‘我没用’。",
  "暧昧给你刚好够猜的温度，最消耗人。问一次清楚的问题，然后用对方的回应或沉默作答。",
  "道歉不是自动售货机；承认具体行为，再说会怎么改。若只是换回好脸色，那不是修复，是讨债。",
  "孤单会让任何一个说‘在吗’的人像灵魂伴侣，危险就在这里。可以求陪伴，但别把标准丢在地上。",
  "想辞职不等于没用，但凌晨裸辞也不是勇敢。先算三个月现金流、更新履历，再决定离开得多漂亮。",
  "后悔是资料，不是刑具。复盘事实、代价和��警信号，别把一次错误升级成‘我这个人就是这样’。",
  "你现在最需要的不是漂亮话，而是把事实、委屈和恐惧拆开；先说最具体的那个瞬间，别急着替所有人找理由。",
]

const HEAL_RICH = [
  "被老板点名会让人一路把那句话带上 MRT，但对方的评价只是瞬间反馈，不是你的成绩单；我们慢慢分辨事实和刺痛。",
  "你已经把很多夜晚交给工作了，累不是不够有野心，是身体也该被算进生活。今晚先离开工作群一小段时间。",
  "租房的孤独很具体：门打开没有‘你回来了’，账单却准时出现。你不必因为寂寞责怪自己，我们可以找一个不勉强的连接方式。",
  "你在关系里反复确认有没有做错，已经很消耗了。被爱不该像 KL 塞车找出口，先从你真实的不安和需要开始。",
  "分手后的想念不是退步，只是这段关系曾进入你的日常。我们不用急着复合，先把失去的东西一件件说清楚。",
  "我听见的不是一句‘累’，而是你很久没有被允许停下来。喝点水、洗个脸，或把手机放远十分钟都可以。",
  "钱的压力会让呼吸变窄，尤其租金、交通和日常开销一起压来时。你不用羞耻，我们先只看最紧急的一笔。",
  "你可以爱家人，也保留对自己人生节奏的决定权。今晚不用准备完美辩论，先找到一句保护你的短回答。",
  "被朋友伤到特别孤单，因为你以为那里安全。你不用马上原谅或定义结局，先让我听见那份委屈。",
  "夜里房间会把念头放大，不必逼自己马上睡着；把脑中的事情写在纸上，让它们暂时离开身体。",
  "害怕还没发生的事，会让���提前失败很多遍；这不是软弱。我们把已经发生和担心发生的分开，一步一步来。",
  "想去 Langkawi 看海，可能是你需要喘气的信号，不是任性。暂时不能出发，也可以安排一点真正像休息的时间。",
  "深夜 mamak 档的灯很亮，心事有时反而清楚。先吃一点热的东西，给身体一个被照顾的信号，再慢慢说。",
  "通勤把情绪磨薄，回家没力气解释很正常。你不是冷漠，只是今天消耗很多；今晚可以不回应任何人一会儿。",
  "同事升职时心里酸一下不让你成为坏人。你可以祝福他，也承认自己的停滞感，我们看看你真正想要什么。",
  "等待回复让一天变成很多小失望。你值得清楚的沟通，不必靠猜测换安全感，先照顾那个盯着手机的自己。",
  "冲突后你可能既想被理解又怕说错。先分清愿意负责的部分和不该独自承担的部分，修复应该有两个人。",
  "一个人不代表没有被爱，只是今晚房间太安静。你可以在这里说完整，也可以发一句‘我今天有点难过’给安全的人。",
  "这份工作让你很久没有恢复过来，不必今晚决定留下或离开；先看健康、现金缓冲和可以求助的人。",
  "会后悔说明你在乎，不代表要一直惩罚自己。我们可以从中学习，也允许当时的你已经尽力了。",
]

function buildRichLocalReply(mode: Mode, text: string, history: Message[]): string {
  const turn = history.filter((message) => message.role === "user").length
  const lower = text.toLowerCase()
  if (turn === 0) return mode === "toxic" ? FIRST_TOXIC_REPLY : FIRST_HEAL_REPLY

  const bank = mode === "toxic" ? TOXIC_RICH : HEAL_RICH
  const groups = [
    ["老板", "boss", "上司", "加班", "ot", "office"],
    ["租房", "房租", "室友"], ["男朋友", "女朋友", "对象", "分手", "前任", "暧昧"],
    ["累", "疲惫", "撑不住"], ["钱", "薪水", "账单"], ["家人", "父母", "催婚"],
    ["mamak", "langkawi", "mrt", "lrt"],
  ]
  const groupIndex = groups.findIndex((group) => group.some((keyword) => lower.includes(keyword)))
  const offset = groupIndex >= 0 ? groupIndex * 2 : text.length
  const card = bank[(turn * 3 + offset) % bank.length]
  const previous = history.filter((message) => message.role === "user").slice(-2).map((message) => message.text).join("；")
  const context = previous ? `我把你前面说的“${previous.slice(0, 90)}”也放在一起听了。` : ""
  const question = mode === "toxic" ? "你现在最想保住的是边界、尊严，还是自己的时间？" : "此刻你更需要被听见，还是一起找一个不压垮你的下一步？"
  return `${context}${card} ${question}`
}

function buildLocalReply(mode: Mode, text: string, history: Message[]): string {
  const turn = history.filter((message) => message.role === "user").length + 1
  const lower = text.toLowerCase()
  const urgent = /自杀|自残|不想活|伤害自己|杀了他|跳楼|轻生|suicide|hurt myself/.test(lower)
  const topic = /老板|工作|加班|同事|公司|升职|office|boss/.test(lower)
    ? "职场"
    : /钱|薪水|房租|债|贷款|epf|账单|穷/.test(lower)
      ? "金钱"
      : /家人|父母|妈妈|爸爸|结婚|催婚|孩子/.test(lower)
        ? "家庭"
        : /分手|对象|男朋友|女朋友|暧昧|感情|背叛/.test(lower)
          ? "关系"
          : "这件事"
  const previous = history.filter((message) => message.role === "user").slice(-2).map((message) => message.text).join("；")

  if (urgent) {
    return "我先不分析对错：你现在的安全比这场争执重要。请先离开危险物品或高处，去找一个能陪着你的人，并直接告诉对方“我现在不安全，需要你陪我”。如果你已经准备行动，请立即联系当地紧急服务；你也可以告诉我，你此刻是有具体计划，还是痛苦已经大到让你这样说？"
  }

  if (mode === "toxic") {
    if (turn === 1) return `先把话说直：${topic}让你难受，不等于它有资格接管今晚。你现在描述的是“${text}”，但真正要处理的可能是边界、证据，还是你把别人的评价当成了判决？先告诉我，最刺你的那一句话或那个动作是什么。`
    if (topic === "职场") return `你已经连续把${topic}带进这段对话了：${previous}。所以问题不只是今天被说了，而是你在一个把加班当忠诚的环境里，开始怀疑自己的价值。老板的语气不是绩效数据。明天先留下可核对的记录，再决定要不要反击；现在最想保住的是工作、尊严，还是睡眠？`
    if (topic === "金钱") return `钱的问题不能靠一句“想开点”解决，但也别让焦虑把账单变成怪兽。你说的是${text}，我们先拆成固定支出、可延后支出和真正的红线；别在凌晨冲动借贷��消费。你眼下最紧的是现金流，还是那种“我永远追不上”的羞耻感？`
    return `你不是在描述一件孤立的小事，${topic}背后还有前几轮没有说完的那口气。说句难听但有用的：猜对方心里怎么想，不会自动改变结果。把今晚能控制的部分圈出来，剩下的明天处理。你希望我帮你看事实，还是帮你拆出一个行动？`
  }

  if (turn === 1) return `我先接住你说的“${text}”。这听起来不只是${topic}本身，还有你一个人消化它时的疲惫。你不用马上想通；如果愿意，我们慢一点看：今天发生的哪一个瞬间，让你最难受？`
  if (topic === "职场") return `我记得你前面提到的${previous}。连续的${topic}压力会让人把老板的评价听成对整个人的否定，但那两件事不是一回事。今晚先把肩膀放下来，明天只选一个可处理的小动作：记录事实、找同事核对，或给自己留一段不回消息的时间。你现在更需要被听见，还是一起���办法？`
  if (topic === "家庭") return `谢谢你继续说。家庭的话很近，所以才特别容易刺进去；你可以爱他们，同时不同意他们替你安排人生。先不用回答所有期待，今晚只照顾自己的感受。刚才那件事里，你最希望家人理解你的哪一部分？`
  return `我把你这几轮的话连起来听到了：${previous}。这不是一句安慰就能抹平的事，但你已经在认真辨认自己的需要。我们不急着做重大决定，先找一个今晚能让你少消耗一点的选择。此刻你希望我陪你把情绪说完，还是帮你整理下一步？`
}

export function MidnightOasis() {
  const [mode, setMode] = useState<Mode>("toxic")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [freeMessages, setFreeMessages] = useState(0)
  const [payOpen, setPayOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const config = MODE_CONFIG[mode]

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, isTyping])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function submit() {
    const text = input.trim()
    if (!text || isTyping) return

    if (freeMessages >= 3) {
      setPayOpen(true)
      return
    }

    const currentMode = mode
    setFreeMessages((count) => count + 1)
    const userMsg: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      text,
      mode: currentMode,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    const conversation = [
      ...messages.map((message) => ({
        role: message.role === "ai" ? ("assistant" as const) : ("user" as const),
        content: message.text,
      })),
      { role: "user" as const, content: text },
    ]

    void (async () => {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: currentMode, messages: conversation }),
        })
        const data = (await response.json()) as { text?: string; error?: string }
        if (!response.ok || !data.text) throw new Error(data.error || "Gemini 请求失败")

        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-ai`, role: "ai", text: data.text!, mode: currentMode },
        ])
      } catch (error) {
        console.error("[v0] Chat request failed", error)
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-ai-error`,
            role: "ai",
            text: "今晚的连线有点不稳，先别急着把问题归咎于自己。请稍等片刻，再试一次。",
            mode: currentMode,
          },
        ])
      } finally {
        setIsTyping(false)
      }
    })()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return
      e.preventDefault()
      submit()
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 p-4 text-slate-50">
      <div className="flex h-[88dvh] max-h-[900px] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/5 bg-slate-900 shadow-2xl">
        {/* Header */}
        <header className="border-b border-white/5 px-6 py-5 text-center">
          <h1 className="text-lg font-semibold tracking-tight">Midnight Oasis</h1>
          <p className="mt-0.5 text-xs text-slate-400">深夜情绪垃圾桶与避难所</p>
        </header>

        {/* Mode selector */}
        <div className="flex gap-2 px-4 pt-4">
          {(Object.keys(MODE_CONFIG) as Mode[]).map((m) => {
            const c = MODE_CONFIG[m]
            const Icon = c.icon
            const active = mode === m
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={active}
                className={[
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300",
                  active
                    ? `${c.accentSoft} ${c.glow} ${m === "heal" ? "text-slate-950" : "text-white"}`
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700/70 hover:text-slate-200",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
                {c.label}
              </button>
            )
          })}
        </div>

        {/* Chat window */}
        <div
          ref={scrollRef}
          className="mx-4 mt-4 flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl bg-slate-950/60 p-4"
        >
          <div className="flex max-w-[82%] flex-col gap-1 self-start">
            <span className={`text-[11px] font-medium ${config.accent}`}>{config.label}</span>
            <div className="rounded-2xl rounded-bl-sm border border-white/5 bg-slate-800/80 px-3.5 py-2.5 text-sm leading-relaxed text-slate-100">
              {config.welcome}
            </div>
          </div>

          {messages.map((message) => {
            const isUser = message.role === "user"
            const msgConfig = MODE_CONFIG[message.mode]
            return (
              <div
                key={message.id}
                className={`flex max-w-[82%] flex-col gap-1 ${isUser ? "self-end" : "self-start"}`}
              >
                {!isUser && (
                  <span className={`text-[11px] font-medium ${msgConfig.accent}`}>{msgConfig.label}</span>
                )}
                <div
                  className={[
                    "whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    isUser
                      ? "rounded-br-sm bg-slate-700 text-white"
                      : "rounded-bl-sm border border-white/5 bg-slate-800/80 text-slate-100",
                  ].join(" ")}
                >
                  {message.text}
                </div>
              </div>
            )
          })}

          {isTyping && (
            <div className="flex max-w-[82%] flex-col gap-1 self-start">
              <span className={`text-[11px] font-medium ${config.accent}`}>{config.label}</span>
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-white/5 bg-slate-800/80 px-4 py-3.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-4 pb-3 pt-4">
          <div className="flex items-end gap-2 rounded-2xl border border-white/5 bg-slate-950/60 p-1.5">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={config.placeholder}
              className="max-h-28 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim() || isTyping}
              aria-label="发送"
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all",
                input.trim() && !isTyping
                  ? `${config.accentSoft} ${mode === "heal" ? "text-slate-950" : "text-white"}`
                  : "bg-slate-800 text-slate-600",
              ].join(" ")}
            >
              <ArrowUp className="h-4.5 w-4.5" strokeWidth={2.4} />
            </button>
          </div>

          {/* Paywall banner */}
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-2.5 text-xs font-medium text-white/95 transition-opacity hover:opacity-90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            解锁深夜 1 对 1 无限深度连线 (RM 9.90) · {freeMessages}/3 次免费
          </button>
        </div>
      </div>

      {payOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pay-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-xs rounded-3xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">

            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-blue-600/20 to-violet-600/20 px-3 py-1 text-xs font-medium text-violet-300">
                <Sparkles className="h-3.5 w-3.5" />
                解锁无限深度连线
              </span>

              <h2 id="pay-title" className="mt-4 text-base font-semibold text-slate-50">
                使用 DuitNow QR 扫码转账
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                今日免费次数已用完，请扫描下方 DuitNow QR 支付 RM 9.90 解锁无限畅聊。支付完成前，暂时无法���续发送消息。
              </p>

              <div className="mt-5 rounded-2xl bg-white p-3">
                <Image
                  src="/duitnow-qr.png"
                  alt="DuitNow 付款二维码"
                  width={220}
                  height={340}
                  className="h-auto max-h-72 w-52 object-contain"
                />
              </div>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-sm text-slate-400">RM</span>
                <span className="text-3xl font-bold text-slate-50">9.90</span>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5" />
                DuitNow 安全加密支付 · 深夜陪你到天亮
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
