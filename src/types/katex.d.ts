declare module 'katex/dist/contrib/auto-render.mjs' {
  interface RenderOptions {
    delimiters?: Array<{left: string; right: string; display: boolean}>;
    throwOnError?: boolean;
    errorColor?: string;
    macros?: Record<string, string>;
    colorIsTextColor?: boolean;
    maxSize?: number;
    maxExpand?: number;
    trust?: boolean | ((context: {command: string}) => boolean);
    strict?: boolean | string;
    output?: 'html' | 'mathml' | 'htmlAndMathml';
    leqno?: boolean;
    fleqn?: boolean;
    globalGroup?: boolean;
    displayMode?: boolean;
  }

  function renderMathInElement(
    elem: HTMLElement,
    options?: RenderOptions
  ): void;

  export default renderMathInElement;
}
