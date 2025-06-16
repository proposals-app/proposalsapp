# DOM Sizer Addon Usage Guide

## Overview

The DOM Sizer addon is a custom Storybook addon that provides comprehensive DOM analysis for any
component story. It measures and reports detailed information about all visible DOM elements.

## How to Use

### 1. Access the DOM Sizer

1. Navigate to any Storybook story
2. Look for the "DOM Sizer" tab in the addons panel (bottom section of Storybook)
3. Click on the "DOM Sizer" tab to activate it

### 2. Automatic Measurement

- The addon automatically measures DOM elements when you switch to a story
- It displays "🔄 Auto-measuring DOM elements..." during the process
- Results appear immediately after measurement completes

### 3. Available Controls

- **🔄 Refresh**: Re-measure the current story's DOM elements

### 4. Data Provided

For each visible DOM element, the addon provides:

- **tagName**: HTML tag (div, button, span, etc.)
- **id**: Element ID if present
- **className**: Complete CSS class names
- **path**: Full CSS selector path to the element
- **dimensions**: Exact measurements
  - width: Element width in pixels
  - height: Element height in pixels
  - top: Distance from top of viewport
  - left: Distance from left of viewport
- **text**: Text content (truncated to 50 chars)

### 5. Example Output

```json
{
  "tagName": "div",
  "id": null,
  "className": "flex flex-row items-center gap-2 p-2",
  "path": "div > div.light > div > div.flex.flex-row.items-center.gap-2.p-2",
  "dimensions": {
    "width": 116,
    "height": 48,
    "top": 271,
    "left": 692
  },
  "text": "initially postedabout 1 hour ago"
}
```

### 6. Key Features

- **Comprehensive Analysis**: Measures ALL visible elements with non-zero dimensions
- **Full Visibility**: Shows complete JSON output without truncation in the panel
- **Real-time Updates**: Automatically updates when switching between stories
- **Detailed Paths**: Provides complete CSS selector paths for element identification

### 7. Use Cases

- **Component Layout Analysis**: Get exact dimensions and positioning
- **Debugging Layout Issues**: Identify element sizes and positions
- **Documentation**: View measurements for design specs
- **Testing**: Verify component dimensions match design requirements
- **Component Comparison**: Compare layouts between different story variants

## Tips

- The addon only measures elements with non-zero width and height
- Text content is truncated to 50 characters in the display
- The full JSON output shows all measured elements directly in the panel
- You can manually select and copy the JSON data from the panel if needed
