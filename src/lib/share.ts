// reckoner — plain-text calculator notepad
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

// A whole sheet travels inside the URL fragment — no server, no account.
// Compression uses the browser's native CompressionStream ("d:" prefix)
// with a plain base64url fallback ("u:" prefix) for older engines.

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encodeShare(text: string): Promise<string> {
  const utf8 = new TextEncoder().encode(text);
  try {
    if (typeof CompressionStream !== "undefined") {
      const stream = new Blob([utf8]).stream().pipeThrough(
        new CompressionStream("deflate-raw"),
      );
      const buf = await new Response(stream).arrayBuffer();
      return "d:" + toB64url(new Uint8Array(buf));
    }
  } catch {
    // fall through to uncompressed
  }
  return "u:" + toB64url(utf8);
}

export async function decodeShare(payload: string): Promise<string | null> {
  try {
    const mode = payload.slice(0, 2);
    const body = payload.slice(2);
    if (mode === "u:") {
      return new TextDecoder().decode(fromB64url(body));
    }
    if (mode === "d:") {
      const stream = new Blob([fromB64url(body)]).stream().pipeThrough(
        new DecompressionStream("deflate-raw"),
      );
      const buf = await new Response(stream).arrayBuffer();
      return new TextDecoder().decode(buf);
    }
    return null;
  } catch {
    return null;
  }
}
