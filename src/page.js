const computeIsChat = () => {
  const href = window.location.href.toLowerCase();
  if (href.includes('live_chat') || href.includes('livechat') || href.includes('chat_replay') || href.includes('is_chat=1')) return true;
  if (document.querySelector('yt-live-chat-renderer, yt-live-chat-app, #chat-messages, #live-chat-frame')) return true;
  if (document.documentElement.classList.contains('yt-live-chat-app') || (window.name && window.name.toLowerCase().includes('chat'))) return true;

  // Block HyperChat
  if (href.includes('hyperchat_embed')) return true;
  if (window.name && window.name.toLowerCase().includes('hyperchat')) return true;
  if (window.frameElement?.id === 'hyperchat') return true;

  return false;
};

let __isChatCached = false;
export const isChat = () => (__isChatCached ||= computeIsChat());
