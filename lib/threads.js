import { AppError, jsonRequest } from './network.js';
const MAX_POSTS = 500;

export function parseThreadURL(value) {
  let url;
  try { url = new URL(value); } catch { throw new AppError('Enter a public Bluesky post URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new AppError('Use a public HTTPS post URL.');
  const host = url.hostname.toLowerCase();
  if (host === 'bsky.app') {
    const match = url.pathname.match(/^\/profile\/([^/]+)\/post\/([a-zA-Z0-9]+)\/?$/);
    if (match && /^(did:plc:[a-z2-7]+|[a-zA-Z0-9.-]+)$/.test(match[1])) return { platform: 'bluesky', actor: match[1], id: match[2], url: `https://bsky.app/profile/${match[1]}/post/${match[2]}` };
  }
  throw new AppError('Only individual public Bluesky post URLs are supported. Profiles, feeds, searches, and DMs are not.');
}
function bskyPost(post) {
  const id = post.uri;
  return { id, authorId: post.author.did, name: post.author.displayName || post.author.handle, handle: post.author.handle,
    text: String(post.record?.text || ''), parentId: post.record?.reply?.parent?.uri || null,
    url: `https://bsky.app/profile/${encodeURIComponent(post.author.did)}/post/${encodeURIComponent(id.split('/').at(-1))}` };
}
export async function fetchBluesky(thread, { request = jsonRequest, signal, onPost = () => {} } = {}) {
  const get = (method, params) => request(`https://public.api.bsky.app/xrpc/${method}?${new URLSearchParams(params)}`, { signal, service: 'Bluesky' });
  const did = thread.actor.startsWith('did:') ? thread.actor : (await get('com.atproto.identity.resolveHandle', { handle: thread.actor })).did;
  if (typeof did !== 'string' || !/^did:[a-z]+:[A-Za-z0-9._:%-]+$/.test(did)) throw new AppError('Bluesky could not resolve that account.', 502);
  const root = `at://${did}/app.bsky.feed.post/${thread.id}`;
  const posts = new Map(), expected = new Map(), edges = new Map(), expanded = new Set();
  const queue = [root]; let unavailable = false, requests = 0;
  while (queue.length && posts.size < MAX_POSTS && requests < 40) {
    const anchor = queue.shift();
    if (expanded.has(anchor)) continue;
    expanded.add(anchor); requests++;
    const data = await get('app.bsky.feed.getPostThread', { uri: anchor, depth: '10', parentHeight: '0' });
    if (data.thread?.post?.uri !== anchor) {
      if (anchor === root) throw new AppError('That Bluesky post is unavailable or not publicly accessible.', 404);
      unavailable = true; continue;
    }
    const walk = (node, parent = null, level = 0) => {
      if (level > 20 || !node?.post) { unavailable = true; return; }
      const post = node.post;
      if (parent && post.record?.reply?.parent?.uri !== parent) return;
      if (!posts.has(post.uri) && posts.size >= MAX_POSTS) return;
      if (!post.author?.did || !post.author?.handle) { unavailable = true; return; }
      const fresh = !posts.has(post.uri);
      posts.set(post.uri, bskyPost(post));
      if (fresh) onPost(posts.get(post.uri));
      expected.set(post.uri, Math.max(0, Number(post.replyCount) || 0));
      if (!edges.has(post.uri)) edges.set(post.uri, new Set());
      for (const reply of node.replies || []) {
        if (reply?.post?.record?.reply?.parent?.uri === post.uri) edges.get(post.uri).add(reply.post.uri);
        walk(reply, post.uri, level + 1);
      }
      if ((edges.get(post.uri)?.size || 0) < expected.get(post.uri) && !expanded.has(post.uri)) queue.push(post.uri);
    };
    walk(data.thread);
  }
  const incomplete = unavailable || queue.length > 0 || posts.size >= MAX_POSTS || [...expected].some(([id, n]) => (edges.get(id)?.size || 0) < n);
  const warnings = incomplete ? ['Bluesky returned an incomplete thread (hidden, missing, or capped replies). Counts and top-20 ranking cover retrieved posts only.'] : [];
  return { platform: 'bluesky', url: thread.url, posts: [...posts.values()], warnings, incomplete };
}
export function rankPosters(posts) {
  const authors = new Map(), seen = new Set();
  for (const p of posts) {
    if (seen.has(p.id)) continue; seen.add(p.id);
    if (!authors.has(p.authorId)) authors.set(p.authorId, { id: p.authorId, name: p.name, handle: p.handle, posts: [] });
    authors.get(p.authorId).posts.push(p);
  }
  return [...authors.values()].sort((a,b) => b.posts.length-a.posts.length || a.id.localeCompare(b.id)).slice(0,20).map(a => ({ ...a, count: a.posts.length }));
}
