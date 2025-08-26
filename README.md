# 🔄 API Data Recorder

Tool untuk merekam API dari berbagai web

## ✨ Features

- 📊 Record API calls
- 🔍 Intercept API calls
- 💾 Export data to JSON
- 🔐 Wallet interaction monitoring

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/fallenstarzz/api-grabber.git

cd api-grabber

# Install dependencies
npm install
npm run build

if you see an error fix first then
npm run clean
npm run build

if work
npm start
```

### Usage

```javascript
// Import recorder
const SwapRecorder = require('./src/complete-swap-recorder.js');

// Start recording
const recorder = new SwapRecorder();
recorder.startRecording();

// Get recorded data
const data = recorder.getMissingData();
console.log(data);
```

## 📖 Documentation

See [docs/](./docs) for detailed documentation.

## 🤝 Contributing

Pull requests are welcome!

## 📄 License

MIT © 2025 fallenstarzz
