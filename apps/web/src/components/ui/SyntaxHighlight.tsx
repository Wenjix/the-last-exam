import { useMemo } from 'react';

interface SyntaxHighlightProps {
  code: string;
  language?: string;
}

interface Token {
  text: string;
  className: string;
}

const PYTHON_KEYWORDS = new Set([
  'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'import', 'from',
  'as', 'with', 'try', 'except', 'finally', 'raise', 'pass', 'break', 'continue',
  'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'lambda', 'yield',
  'global', 'nonlocal', 'del', 'assert',
]);

const JS_KEYWORDS = new Set([
  'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return',
  'import', 'from', 'export', 'default', 'class', 'new', 'this', 'super',
  'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'of', 'in',
  'typeof', 'instanceof', 'null', 'undefined', 'true', 'false', 'switch', 'case',
  'break', 'continue',
]);

function tokenizeLine(line: string, language: string): Token[] {
  const keywords = language === 'python' ? PYTHON_KEYWORDS : JS_KEYWORDS;
  const tokens: Token[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    // Comments
    const commentChar = language === 'python' ? '#' : '//';
    if (remaining.startsWith(commentChar)) {
      tokens.push({ text: remaining, className: 'syn-comment' });
      break;
    }

    // Strings (double or single quotes)
    const strMatch = remaining.match(/^(["'`])(?:\\.|(?!\1).)*\1/);
    if (strMatch) {
      tokens.push({ text: strMatch[0], className: 'syn-string' });
      remaining = remaining.slice(strMatch[0].length);
      continue;
    }

    // Numbers
    const numMatch = remaining.match(/^\b\d+(\.\d+)?\b/);
    if (numMatch) {
      tokens.push({ text: numMatch[0], className: 'syn-number' });
      remaining = remaining.slice(numMatch[0].length);
      continue;
    }

    // Identifiers / keywords
    const identMatch = remaining.match(/^[a-zA-Z_]\w*/);
    if (identMatch) {
      const word = identMatch[0];
      if (keywords.has(word)) {
        tokens.push({ text: word, className: 'syn-keyword' });
      } else if (remaining[word.length] === '(') {
        tokens.push({ text: word, className: 'syn-function' });
      } else {
        tokens.push({ text: word, className: 'syn-default' });
      }
      remaining = remaining.slice(word.length);
      continue;
    }

    // Operators and punctuation
    tokens.push({ text: remaining[0], className: 'syn-default' });
    remaining = remaining.slice(1);
  }

  return tokens;
}

export function SyntaxHighlight({ code, language = 'python' }: SyntaxHighlightProps) {
  const lines = useMemo(() => {
    return code.split('\n').map((line, lineIdx) => ({
      lineNum: lineIdx + 1,
      tokens: tokenizeLine(line, language),
    }));
  }, [code, language]);

  return (
    <div className="syntax-highlight">
      {lines.map((line, i) => (
        <div key={i} className="syn-line">
          <span className="syn-line-num">{line.lineNum}</span>
          <span className="syn-line-content">
            {line.tokens.map((token, j) => (
              <span key={j} className={token.className}>{token.text}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
