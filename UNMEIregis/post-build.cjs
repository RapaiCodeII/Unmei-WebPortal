const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'dist', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// The Vite single-file build inlines the app as one <script type="module">.
// String literals inside that bundle can contain "</script>", which would
// terminate the tag early and break the page. Escape ONLY those occurrences
// inside the module bundle — external <script src> tags in <head> must stay
// untouched.
const openTag = '<script type="module"';
const openIdx = html.lastIndexOf(openTag);
if (openIdx === -1) {
    console.log('No inline module script found; nothing to escape.');
} else {
    const tagEnd = html.indexOf('>', openIdx);
    if (tagEnd === -1) throw new Error('Malformed module script tag in build output.');
    const contentStart = tagEnd + 1;
    const closeIdx = html.indexOf('</script>', contentStart);
    if (closeIdx === -1) {
        throw new Error('Inline module script has no closing tag — build output unexpected.');
    }
    const inner = html.slice(contentStart, closeIdx);
    const patched = inner.replace(/<\/script>/gi, '<\\/script>');
    if (patched !== inner) {
        html = html.slice(0, contentStart) + patched + html.slice(closeIdx);
        fs.writeFileSync(htmlPath, html, 'utf-8');
        console.log('Post-build script tag escaping completed (module bundle only).');
    } else {
        console.log('No stray </script> literals found in module bundle.');
    }
}
