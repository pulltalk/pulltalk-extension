# PullTalk Extension

Clarify code reviews in 60 seconds — add voice, video, and visual context directly to GitHub pull requests.

## Features

- Record your screen and microphone directly in GitHub PRs
- Automatic upload to Firebase Storage
- Automatic link insertion into PR comments
- Beautiful UI that matches GitHub's design

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Chrome/Edge browser (for testing)
- Firebase project with Storage enabled

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pulltalk/pulltalk-extension.git
   cd pulltalk-extension
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Firebase:**
   - Copy `.env.example` to `.env` and fill in your Firebase values
     ```bash
     cp .env.example .env
     ```
   - Firebase reads config from Vite env values (see `src/firebase.ts`)
   - Make sure Firebase Storage is enabled in your Firebase project
   - Configure Firebase Storage rules for the `pulltalk_videos/` path

4. **Build the extension:**
   ```bash
   npm run build
   ```

5. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder

## Development

### Development Mode

```bash
npm run dev
```

This will:
- Watch for file changes
- Rebuild automatically
- Reload the extension in Chrome (you may need to manually reload)

### Build for Production

```bash
npm run build
```

This will:
- Type-check the code
- Build and bundle everything
- Output to `dist/` folder

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check
npm run type-check
```

## Project Structure

```
.
├── src/
│   ├── content.ts      # Main content script (injected into GitHub)
│   ├── recorder.ts     # Screen recording functionality
│   ├── upload.ts       # Firebase Storage upload
│   ├── firebase.ts     # Firebase initialization
│   └── github.ts       # GitHub utility functions
├── public/
│   └── icons/          # Extension icons
├── manifest.json       # Chrome extension manifest
├── vite.config.ts      # Vite build configuration
├── tsconfig.json       # TypeScript configuration
└── package.json        # Dependencies and scripts
```

## How It Works

1. **Content Script Injection**: The extension injects a "Record" button into GitHub PR comment boxes
2. **Screen Recording**: Uses browser's `getDisplayMedia` API to capture screen + microphone
3. **Video Upload**: Uploads the recorded video to Firebase Storage
4. **Link Insertion**: Automatically inserts a markdown link to the video in the comment box

## Firebase Setup

**Quick Setup:**
1. Enable Firebase Storage in your Firebase project
2. Configure storage rules in Firebase Console (Storage → Rules). Example starter rules:

```txt
rules_version = '2';
service firebase.storage {
   match /b/{bucket}/o {
      match /pulltalk_videos/{allPaths=**} {
         allow read: if true;
         allow write: if request.resource.size < 100 * 1024 * 1024
                            && request.resource.contentType.matches('video/.*');
      }
   }
}
```

For production, prefer requiring authentication for uploads:

```txt
allow write: if request.auth != null
                   && request.resource.size < 100 * 1024 * 1024
                   && request.resource.contentType.matches('video/.*');
```

3. Copy `.env.example` to `.env` and fill values from Firebase project settings
4. The extension will automatically use your Firebase configuration

## Troubleshooting

### Extension not loading
- Make sure you built the extension: `npm run build`
- Check Chrome's extension error page: `chrome://extensions/`
- Look for errors in the browser console

### Recording not working
- Grant screen capture permissions when prompted
- Grant microphone permissions when prompted
- Check browser console for errors

### Upload failing
- Verify Firebase Storage is enabled
- Check Firebase Storage rules in Firebase Console
- Verify file size is under 100MB
- Check browser console for detailed error messages

### Button not appearing
- Make sure you're on a GitHub PR page (`/pull/*`)
- Refresh the page
- Check browser console for errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run lint` and `npm run type-check`
5. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) file

## Support

- Open an issue on GitHub
- Include Firebase Storage rule and console error details when reporting upload issues

