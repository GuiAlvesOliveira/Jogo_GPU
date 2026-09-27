// Tooltip global (um único elemento reposicionado pelo mouse).

let tipEl: HTMLDivElement | null = null;

function ensure(): HTMLDivElement {
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.id = "tip";
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
  }
  return tipEl;
}

export function showTip(html: string, x: number, y: number): void {
  const t = ensure();
  t.innerHTML = html;
  t.hidden = false;
  const r = t.getBoundingClientRect();
  let left = x + 14;
  let top = y + 14;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${Math.max(8, top)}px`;
}

export function hideTip(): void {
  if (tipEl) tipEl.hidden = true;
}

// Liga um tooltip a um elemento (o conteúdo pode ser calculado na hora).
export function bindTip(target: Element, content: string | (() => string)): void {
  target.addEventListener("mousemove", (e) => {
    const me = e as MouseEvent;
    showTip(typeof content === "function" ? content() : content, me.clientX, me.clientY);
  });
  target.addEventListener("mouseleave", hideTip);
}
