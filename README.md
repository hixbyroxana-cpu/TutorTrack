<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/5d08ae90-2cb0-4f57-aec2-bab1e9aaf619

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create [.env.local](.env.local) and set:
   - `VITE_GEMINI_API_KEY` to your Gemini API key
   - Firebase web config values (`VITE_FIREBASE_*`) from your Firebase project settings
3. In Firebase Console:
   - Create a Firestore database
   - Enable Authentication -> Sign-in method -> Anonymous
   - Set Firestore Rules to allow only authenticated users:
     `allow read, write: if request.auth != null;`
4. Run the app:
   `npm run dev`
