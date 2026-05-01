---
name: Bug report
about: Something is not working as expected
title: ''
labels: bug
assignees: ''
---

## Description

A clear and concise description of the bug.

## Minimal reproduction

<!--
  Please provide the smallest possible HTML file that demonstrates the issue.
  A single self-contained file is ideal — paste it here or link to a CodePen / JSFiddle.
-->

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="kselect.min.css">
</head>
<body>
  <select id="s">
    <option value="a">Option A</option>
    <option value="b">Option B</option>
  </select>
  <script src="kselect.min.js"></script>
  <script>
    Kselect.init('#s');
    // describe what you expected and what happened instead
  </script>
</body>
</html>
```

## Expected behaviour

What you expected to happen.

## Actual behaviour

What actually happened. Include any console errors, screenshots, or screen recordings if helpful.

## Environment

- kselect.js version:
- Browser(s) affected:
- OS:
- Device type (desktop / phone / tablet):
