/**
 * Simple, robust Valve KeyValues (VDF / ACF) parser
 */

function parseVdf(text) {
  const lines = text.split(/\r?\n/);
  const root = {};
  const stack = [root];
  const keyStack = ['root'];

  const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;

  for (let rawLine of lines) {
    let line = rawLine.trim();
    // Strip comments
    if (line.startsWith('//') || line.length === 0) continue;

    if (line === '{') {
      // Opening brace - the top of stack already has the container created
      continue;
    }

    if (line === '}') {
      // Closing brace - pop stack
      if (stack.length > 1) {
        stack.pop();
        keyStack.pop();
      }
      continue;
    }

    // Extract all quoted tokens in the line
    const tokens = [];
    let match;
    regex.lastIndex = 0;
    while ((match = regex.exec(line)) !== null) {
      tokens.push(match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
    }

    if (tokens.length === 1) {
      // It's a key that opens a new object block
      const key = tokens[0];
      const newObj = {};
      const current = stack[stack.length - 1];
      current[key] = newObj;
      stack.push(newObj);
      keyStack.push(key);
    } else if (tokens.length >= 2) {
      // Key-value pair
      const key = tokens[0];
      const value = tokens[1];
      const current = stack[stack.length - 1];
      current[key] = value;
    }
  }

  return root;
}

module.exports = { parseVdf };
