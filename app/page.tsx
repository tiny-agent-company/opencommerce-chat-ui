"use client"

import * as React from "react"
import {
  ArrowUpIcon,
  CheckIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  LogInIcon,
  RotateCwIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { streamChat, type ChatLink, type ChatProduct } from "@/lib/chat-stream"
import { BinaryStage } from "@/components/binary-stage"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Message, MessageContent, MessageFooter } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"

type Turn = {
  id: string
  role: "user" | "assistant"
  text: string
  links: ChatLink[]
  products: Record<string, ChatProduct>
  chosen?: string
  error?: string
  pending?: boolean
  firstWordMs?: number
  totalMs?: number
}

const SUGGESTIONS = [
  "Find AA batteries on Amazon",
  "Book a table for 2 at an Italian place in SF tonight at 7pm",
  "Find a USB-C charging cable under $20",
]

const ACTION_LINKS: Record<Exclude<ChatLink["kind"], "product">, { label: string; icon: React.ReactNode }> = {
  vault: { label: "Add a card", icon: <CreditCardIcon /> },
  approval: { label: "Approve purchase", icon: <ShieldCheckIcon /> },
  store_login: { label: "Sign in to store", icon: <LogInIcon /> },
}

function demoShopperId() {
  return `shopper_demo_${crypto.randomUUID().slice(0, 8)}`
}

function seconds(ms?: number) {
  return ms === undefined ? "" : `${(ms / 1000).toFixed(1)}s`
}

export default function ChatPage() {
  const [shopperId, setShopperId] = React.useState<string | null>(null)
  const [turns, setTurns] = React.useState<Turn[]>([])
  const [draft, setDraft] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  // UI-only build: a local demo shopper id stands in for the signed cookie the real app uses.
  React.useEffect(() => setShopperId(demoShopperId()), [])

  const update = (id: string, change: (turn: Turn) => Turn) =>
    setTurns((all) => all.map((turn) => (turn.id === id ? change(turn) : turn)))

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy || !shopperId) return
    setDraft("")
    setBusy(true)
    const replyId = crypto.randomUUID()
    setTurns((all) => [
      ...all,
      { id: crypto.randomUUID(), role: "user", text: message, links: [], products: {} },
      { id: replyId, role: "assistant", text: "", links: [], products: {}, pending: true },
    ])
    const started = performance.now()
    let firstWord: number | undefined
    try {
      await streamChat(message, {
        onText: (delta) => {
          firstWord ??= performance.now() - started
          update(replyId, (t) => ({ ...t, text: t.text + delta, firstWordMs: firstWord }))
        },
        onLink: (link) => update(replyId, (t) => ({ ...t, links: [...t.links, link] })),
        onProducts: (products) =>
          update(replyId, (t) => ({
            ...t,
            products: { ...t.products, ...Object.fromEntries(products.map((p) => [p.product_id, p])) },
          })),
        onDone: (reply) => update(replyId, (t) => ({ ...t, text: t.text || reply })),
        onError: (error) => update(replyId, (t) => ({ ...t, error })),
      })
    } catch (error) {
      update(replyId, (t) => ({ ...t, error: String(error) }))
    } finally {
      update(replyId, (t) => ({ ...t, pending: false, totalMs: performance.now() - started }))
      setBusy(false)
    }
  }

  function choose(turnId: string, link: ChatLink) {
    update(turnId, (t) => ({ ...t, chosen: link.url }))
    void send(`I'll take the ${link.title ?? "first one"}${link.price ? ` (${link.price})` : ""}`)
  }

  function reset() {
    setTurns([])
    setShopperId(demoShopperId())
  }

  return (
    <div className="chat-app">
      <BinaryStage fade="in" className="chat-ascii" />
      <header className="site-header">
        <div className="nav-tray site-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/agentcard-trueblue-main.svg" alt="Agentcard" className="h-6 w-auto max-[380px]:h-5" />
          <span className="brand-label">Shopping agent</span>
        </div>
        <div className="nav-tray">
          <Button size="sm" className="rounded-md max-sm:size-8 max-sm:p-0" aria-label="New chat" onClick={reset} disabled={busy}>
            <RotateCwIcon />
            <span className="max-sm:hidden">New chat</span>
          </Button>
        </div>
      </header>

      <main className="chat-main">
        <MessageScrollerProvider autoScroll>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {turns.length === 0 ? (
              <section className="chat-welcome" aria-labelledby="welcome-title">
                <div className="welcome-mark" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/agentcard-white-symbol.svg" alt="" className="size-6" />
                </div>
                <h1 id="welcome-title" className="welcome-title">What should we buy?</h1>
                <p className="welcome-description">
                  Ask for a product, a restaurant table, a delivery, or anything else.
                </p>
                <div className="suggestions" aria-label="Try a suggestion">
                  {SUGGESTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => void send(text)}
                      disabled={!shopperId}
                      className="suggest disabled:opacity-50"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </section>
            ) : (
              <MessageScroller className="h-full">
                <MessageScrollerViewport>
                  <MessageScrollerContent aria-busy={busy} aria-label="Conversation" className="gap-6 px-1 pt-8 pb-4">
                    {turns.map((turn) =>
                      turn.role === "user" ? (
                        <MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor>
                          <Message align="end">
                            <MessageContent>
                              <Bubble align="end">
                                <BubbleContent>{turn.text}</BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      ) : (
                        <MessageScrollerItem key={turn.id} messageId={turn.id}>
                          <AssistantTurn turn={turn} busy={busy} onChoose={(link) => choose(turn.id, link)} />
                        </MessageScrollerItem>
                      ),
                    )}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            )}
          </div>
        </MessageScrollerProvider>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void send(draft)
          }}
          className="composer"
        >
          <div className="window focus-within:border-primary">
            <div className="window-bar">
              <span aria-hidden="true">↳</span>
              <label htmlFor="message">Shopping agent</label>
              <WindowMark />
            </div>
            {/* Only the send key is disabled while the draft is empty. */}
            <InputGroup className="rounded-none border-0 bg-card shadow-none has-disabled:bg-card has-disabled:opacity-100 has-[[data-slot=input-group-control]:focus-visible]:ring-0">
              <InputGroupTextarea
                id="message"
                name="message"
                aria-describedby="demo-note"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    void send(draft)
                  }
                }}
                placeholder="Ask the agent to buy something…"
                rows={1}
                className="min-h-12 max-h-40 px-3 py-3"
              />
              <InputGroupAddon align="block-end" className="px-3 pb-3">
                <span className="hidden font-label text-xs font-normal sm:inline">
                  Enter to send · Shift + Enter for a new line
                </span>
                <InputGroupButton
                  type="submit"
                  variant="default"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label="Send"
                  disabled={busy || !shopperId || !draft.trim()}
                >
                  {busy ? <LoaderCircleIcon className="animate-spin" /> : <ArrowUpIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>
          <p id="demo-note" className="demo-note">Demo only. Replies are scripted and nothing is purchased.</p>
        </form>
      </main>
    </div>
  )
}

function WindowMark() {
  return (
    <span className="window-mark" aria-hidden="true">
      [<svg viewBox="0 0 12 12"><path d="M6 .5v11M1.24 3.25l9.52 5.5M1.24 8.75l9.52-5.5" /></svg>]
    </span>
  )
}

function AssistantTurn({ turn, busy, onChoose }: { turn: Turn; busy: boolean; onChoose: (link: ChatLink) => void }) {
  const products = turn.links.filter((l) => l.kind === "product")
  const actions = turn.links.filter((l) => l.kind !== "product")
  return (
    <Message>
      <MessageContent className="gap-3">
        <div className="flex items-center gap-2 font-label text-xs text-muted-foreground">
          <WindowMark />
          <span>Shopping agent</span>
        </div>
        {turn.pending && !turn.text ? (
          <Bubble variant="muted">
            <BubbleContent className="flex items-center gap-2 text-muted-foreground">
              <LoaderCircleIcon className="size-4 animate-spin text-primary" /> Working on it…
            </BubbleContent>
          </Bubble>
        ) : (
          turn.text && (
            <Bubble variant="muted">
              <BubbleContent className="whitespace-pre-wrap">{turn.text}</BubbleContent>
            </Bubble>
          )
        )}
        {turn.error && (
          <Bubble variant="destructive">
            <BubbleContent>{turn.error}</BubbleContent>
          </Bubble>
        )}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map((link) => {
              const action = ACTION_LINKS[link.kind as keyof typeof ACTION_LINKS]
              return (
                <Button key={link.url} nativeButton={false} render={<a href={link.url} target="_blank" rel="noreferrer" />}>
                  {action.icon}
                  {action.label}
                  {link.kind === "store_login" && link.store ? ` · ${link.store}` : ""}
                </Button>
              )
            })}
          </div>
        )}
        {products.length > 0 && (
          <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
            {products.map((link) => (
              <ProductCard
                key={link.url}
                link={link}
                product={link.product_id ? turn.products[link.product_id] : undefined}
                chosen={turn.chosen === link.url}
                disabled={busy || turn.chosen !== undefined}
                onChoose={() => onChoose(link)}
              />
            ))}
          </div>
        )}
        {!turn.pending && turn.totalMs !== undefined && (
          <MessageFooter className="px-0 font-label font-normal">
            {seconds(turn.totalMs)}
            {turn.firstWordMs !== undefined && turn.totalMs - turn.firstWordMs > 1000
              ? ` · first word at ${seconds(turn.firstWordMs)}`
              : ""}
            {turn.links.length > 0 ? ` · ${turn.links.length} link${turn.links.length === 1 ? "" : "s"}` : ""}
          </MessageFooter>
        )}
      </MessageContent>
    </Message>
  )
}

function ProductCard({
  link,
  product,
  chosen,
  disabled,
  onChoose,
}: {
  link: ChatLink
  product?: ChatProduct
  chosen: boolean
  disabled: boolean
  onChoose: () => void
}) {
  const [imageFailed, setImageFailed] = React.useState(false)
  const image = product?.image_url && !imageFailed ? product.image_url : null
  return (
    <div
      data-chosen={chosen}
      className="group/product product-card flex flex-col overflow-hidden"
    >
      <button
        type="button"
        onClick={onChoose}
        disabled={disabled}
        className="flex flex-1 flex-col text-left disabled:cursor-default"
        aria-label={`Buy ${link.title ?? "this product"}`}
      >
        <div className="flex aspect-square items-center justify-center border-b bg-muted p-3">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="size-full object-contain mix-blend-multiply"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/agentcard-trueblue-symbol.svg" alt="" className="size-8 opacity-20" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          {product?.store && (
            <span className="font-label text-xs text-muted-foreground">
              {product.store}
            </span>
          )}
          <span className="line-clamp-2 text-sm leading-snug font-medium">{link.title ?? link.url}</span>
          {link.price && <span className="font-label text-sm font-medium text-primary">{link.price}</span>}
        </div>
      </button>
      <div className="flex items-center gap-2 border-t p-2">
        <Button size="sm" className="flex-1" onClick={onChoose} disabled={disabled}>
          {chosen ? <CheckIcon /> : null}
          {chosen ? "Chosen" : "Buy this"}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Open at the store"
          nativeButton={false}
          render={<a href={link.url} target="_blank" rel="noreferrer" />}
        >
          <ExternalLinkIcon />
        </Button>
      </div>
    </div>
  )
}
