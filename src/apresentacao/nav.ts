// Navegação entre slides a partir de qualquer módulo (preenchido pelo main.ts).

let goFn: (id: string) => void = () => {};

export function setNav(fn: (id: string) => void): void {
  goFn = fn;
}

export function goTo(id: string): void {
  goFn(id);
}
