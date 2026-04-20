import type { TicketMessage } from './types'
import { uid } from './storage'

export function makeUserMsg(author: string, body: string, at: string = new Date().toISOString()): TicketMessage {
  return { id: uid('m'), author, authorRole: 'you', body, createdAt: at }
}

export function makeAgentMsg(author: string, body: string, at: string = new Date().toISOString()): TicketMessage {
  return { id: uid('m'), author, authorRole: 'agent', body, createdAt: at }
}

export function makeSystemMsg(body: string, at: string = new Date().toISOString()): TicketMessage {
  return { id: uid('m'), author: 'System', authorRole: 'system', body, createdAt: at }
}

export function systemRouted(queue: string, suffix?: string): string {
  return `Routed to Sigenic · ${queue} queue.${suffix ? ' ' + suffix : ''}`
}
