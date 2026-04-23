# Admin Panel - Standalone Application

This is a standalone admin panel application hosted on a different subdomain from the main app.

## Setup

### Prerequisites
- Node.js 16+ installed
- Firebase project configured (uses same project as main app)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app will start on `http://localhost:3001`

### Build for Production

```bash
npm run build
```

This generates optimized files in the `dist/` folder for deployment.

## Structure

```
admin/
├── public/
│   └── index.html           # Entry HTML file
├── src/
│   ├── main.tsx             # React entry point
│   ├── App.tsx              # Root component
│   ├── firebase.ts          # Firebase configuration
│   ├── index.css            # Global styles
│   ├── pages/
│   │   └── Login.tsx        # Admin login page
│   └── components/
│       └── AdminPanel.tsx   # Main admin dashboard
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
├── vite.config.ts           # Vite build config
└── .env.example             # Environment variables template
```

## Features

- **Admin Authentication**: Login with email/password or Google
- **User Management**: View all users in the system
- **Upgrade Management**: Toggle user upgrade status
- **Role-Based Access**: Only users with admin role can access

## Firebase Configuration

The app uses `firebase-applet-config.json` for Firebase credentials. Make sure this file exists and contains valid Firebase config.

## Deployment

### To Vercel (Recommended)

1. Push to a GitHub repository
2. Connect to Vercel
3. Set Environment to Node.js 18+
4. Build Command: `npm run build`
5. Output Directory: `dist`

### To Other Platforms

Build the app and deploy the `dist/` folder to your hosting platform.

## Notes

- This admin panel shares the same Firebase project with the main app
- All data is synchronized in real-time across applications
- The app auto-detects admin role and restricts access accordingly
