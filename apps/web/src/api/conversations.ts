import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Conversation {
  id: string;
  agentId: string;
  title?: string;
  lastMessage?: string;
  updatedAt: string;
  takeover_by: string | null;
  takeover_at: string | null;
}

export interface Session {
  session_id: string;
  user_id: string;
  agent_id: string;
  channel_id: string | null;
  sdk_session_id: string | null;
  title: string | null;
  takeover_by: string | null;
  takeover_at: string | null;
  orchestration_path: string | null;
  current_agent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TakeoverResult {
  sessionId: string;
  takenOverBy: string;
  takenOverAt: string;
}

export interface ReleaseResult {
  sessionId: string;
  released: boolean;
}

export function conversationsQueryOptions() {
  return queryOptions({
    queryKey: ["conversations"],
    queryFn: () => request<Conversation[]>("/conversations"),
  });
}

export function conversationQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["conversations", id],
    queryFn: () => request<Conversation>(`/conversations/${id}`),
  });
}

export interface MessageFeedback {
  rating: "up" | "down";
  reason: string | null;
}

export interface ConversationMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
  feedback?: MessageFeedback;
}

export function conversationMessagesQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["conversations", id, "messages"],
    queryFn: () =>
      request<ConversationMessage[]>(`/conversations/${id}/messages`),
  });
}

export async function createConversation(agentId: string): Promise<Conversation> {
  return request<Conversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({ agentId }),
  });
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await request(`/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await request(`/conversations/${id}`, {
    method: "DELETE",
  });
}

export function agentConversationsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["conversations", { agentId }],
    queryFn: () => request<Conversation[]>(`/conversations?agent_id=${encodeURIComponent(agentId)}`),
  });
}

export function sessionQueryOptions(sessionId: string) {
  return queryOptions({
    queryKey: ["conversations", sessionId, "session"],
    queryFn: () => request<Session>(`/conversations/${sessionId}`),
  });
}

export async function takeoverConversation(sessionId: string): Promise<TakeoverResult> {
  return request<TakeoverResult>(`/conversations/${sessionId}/takeover`, {
    method: "POST",
  });
}

export async function releaseConversation(sessionId: string): Promise<ReleaseResult> {
  return request<ReleaseResult>(`/conversations/${sessionId}/release`, {
    method: "POST",
  });
}
