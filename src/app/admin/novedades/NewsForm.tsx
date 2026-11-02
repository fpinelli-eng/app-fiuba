"use client";

import { useActionState, useState } from "react";
import { BODY_MAX, TITLE_MAX, URL_MAX } from "@/lib/news/model";
import { publishNews, type NewsState } from "./actions";

// Publicar un aviso: título, texto y enlace opcional. Si se publicó, el formulario se vacía;
// si hubo un error, queda lo escrito.

const initial: NewsState = { error: null, published: 0 };

const primary =
  "h-10 whitespace-nowrap rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink";
const field = "w-full rounded-[10px] border border-line-strong bg-bg px-3.5 text-sm text-ink";

export function NewsForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [state, action, pending] = useActionState(async (prev: NewsState, formData: FormData) => {
    const next = await publishNews(prev, formData);
    if (!next.error) {
      setTitle("");
      setBody("");
      setUrl("");
    }
    return next;
  }, initial);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface px-6 py-[22px]">
      <h2 className="text-[19px] font-semibold">Publicar un aviso</h2>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Título
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${field} h-[42px]`}
        />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Texto (opcional)
        <textarea
          name="body"
          rows={4}
          maxLength={BODY_MAX}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={`${field} resize-y py-2.5 leading-normal`}
        />
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Enlace (opcional)
        <input
          name="url"
          type="url"
          maxLength={URL_MAX}
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={`${field} h-[42px]`}
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        {state.published > 0 && !state.error && !title && <span className="text-[13px] text-mint-ink">Publicado.</span>}
        <button type="submit" disabled={pending || !title.trim()} className={primary}>
          {pending ? "Publicando…" : "Publicar"}
        </button>
      </div>
    </form>
  );
}
