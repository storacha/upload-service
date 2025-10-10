# Console Toolkit Documentation

This is the documentation website for Console Toolkit, built with Next.js, TailwindCSS, and aligned with Storacha's design system.

## Features

- **Modern Design**: Clean, minimal interface matching Storacha's console aesthetic
- **Dark/Light Mode**: Built-in theme switching with default dark mode
- **Responsive**: Mobile-first design that works on all devices  
- **Fast Search**: Instant search across all documentation content
- **MDX Support**: Rich markdown content with React component embedding
- **Accessible**: WCAG 2.1 AA compliant navigation and content

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Development

The documentation site is built with:

- **Next.js 14** - React framework with app directory
- **TailwindCSS** - Utility-first CSS framework
- **Headless UI** - Accessible UI components
- **Heroicons** - Beautiful SVG icons
- **next-themes** - Theme switching
- **Fuse.js** - Fuzzy search functionality
- **MDX** - Markdown with JSX support

### Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── */page.tsx         # Documentation pages
├── components/            # Reusable components
│   ├── Layout.tsx         # Main layout wrapper
│   ├── Sidebar.tsx        # Navigation sidebar
│   ├── SearchBar.tsx      # Search functionality
│   ├── ThemeToggle.tsx    # Dark/light mode toggle
│   └── *.tsx              # Other components
└── lib/                   # Utility functions
```

### Customization

The site uses Storacha's color palette and design tokens:

- **Hot Red**: `#E91315` - Primary accent color
- **Hot Yellow**: `#FFC83F` - Secondary accent
- **Hot Blue**: `#0176CE` - Links and interactive elements
- **Gray Dark**: `#1d2027` - Dark backgrounds

### Deployment

The site is optimized for static hosting on:

- **Vercel** (recommended)
- **Netlify** 
- **GitHub Pages**
- **Cloudflare Pages**

Build the static site:

```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
