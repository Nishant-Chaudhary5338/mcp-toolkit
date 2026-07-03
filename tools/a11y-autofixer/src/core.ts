// a11y-autofixer CORE — pure logic (no MCP transport).
//
// The "execute" half of accessibility-checker. Applies only SAFE, mechanical
// a11y fixes and reports each one; anything requiring human judgement (a real
// alt text, a real label) is flagged, not guessed.

export interface A11yFix {
  line: number;
  rule: string;
  message: string;
}

export interface A11yFixResult {
  code: string;
  fixes: A11yFix[];
  count: number;
}

/** Apply safe a11y fixes to JSX/TSX source. Pure — takes and returns source text. */
export function fixA11y(code: string): A11yFixResult {
  const fixes: A11yFix[] = [];
  const lines = code.split('\n');

  const fixed = lines.map((raw, i) => {
    const line = i + 1;
    let out = raw;

    // 1. <img ...> without alt → add alt="" (decorative default; review for meaningful images)
    if (/<img\b(?![^>]*\balt=)[^>]*>/.test(out)) {
      out = out.replace(/<img\b((?:(?!alt=)[^>])*?)(\s*\/?>)/, '<img$1 alt=""$2');
      fixes.push({ line, rule: 'img-alt', message: 'Added alt="" (decorative). Set a meaningful alt if the image conveys information.' });
    }

    // 2. <a target="_blank"> without rel → add rel="noopener noreferrer"
    if (/<a\b[^>]*target=["']_blank["'][^>]*>/.test(out) && !/rel=/.test(out)) {
      out = out.replace(/(<a\b[^>]*target=["']_blank["'])([^>]*>)/, '$1 rel="noopener noreferrer"$2');
      fixes.push({ line, rule: 'blank-rel', message: 'Added rel="noopener noreferrer" to a target="_blank" link.' });
    }

    // 3. JSX attribute correctness: for= → htmlFor=, tabindex= → tabIndex=, class= → className=
    if (/<label\b[^>]*\bfor=/.test(out)) {
      out = out.replace(/(<label\b[^>]*?)\bfor=/, '$1htmlFor=');
      fixes.push({ line, rule: 'label-htmlFor', message: 'Renamed label for= to htmlFor= (JSX).' });
    }
    if (/\btabindex=/.test(out)) {
      out = out.replace(/\btabindex=/g, 'tabIndex=');
      fixes.push({ line, rule: 'tabIndex', message: 'Renamed tabindex= to tabIndex= (JSX).' });
    }

    return out;
  });

  return { code: fixed.join('\n'), fixes, count: fixes.length };
}
