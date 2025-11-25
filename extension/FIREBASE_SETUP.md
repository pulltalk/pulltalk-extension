# Firebase Setup Guide

## Overview
This extension uses Firebase Storage to upload and store video recordings from GitHub PR comments.

## Firebase Configuration

The Firebase configuration is stored in `src/firebase.ts`. The current configuration uses:
- **Project ID**: `[REDACTED-PROJECT]`
- **Storage Bucket**: `[REDACTED-PROJECT].firebasestorage.app`

## Firebase Storage Rules

You need to configure Firebase Storage security rules to allow uploads. Here's a recommended rule:

### Basic Public Upload Rule (Development)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /pulltalk_videos/{allPaths=**} {
      // Allow read access to all files
      allow read: if true;
      
      // Allow write access (upload) - consider adding authentication in production
      allow write: if request.resource.size < 100 * 1024 * 1024  // 100MB limit
                    && request.resource.contentType.matches('video/.*');
    }
  }
}
```

### Production Rule (Recommended)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /pulltalk_videos/{allPaths=**} {
      // Allow read access to all files
      allow read: if true;
      
      // Allow write access with authentication
      allow write: if request.auth != null
                    && request.resource.size < 100 * 1024 * 1024  // 100MB limit
                    && request.resource.contentType.matches('video/.*');
    }
  }
}
```

## Setting Up Firebase Storage Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`[REDACTED-PROJECT]`)
3. Navigate to **Storage** → **Rules**
4. Paste the rules above
5. Click **Publish**

## Storage Organization

Videos are organized in Firebase Storage as:
```
pulltalk_videos/
  ├── video_1234567890_abc123_pr123.webm
  ├── video_1234567891_def456_pr124.webm
  └── ...
```

The filename format is: `video_{timestamp}_{random}_{prId}.webm`

## File Size Limits

- **Current limit**: 100MB per video
- **Firebase free tier**: 5GB total storage
- **Firebase paid tier**: Up to 1TB+ storage

## Security Considerations

1. **Public Access**: Current setup allows public uploads. For production:
   - Enable Firebase Authentication
   - Update storage rules to require authentication
   - Consider adding rate limiting

2. **API Key**: The Firebase API key is exposed in the extension code. This is normal for client-side apps, but ensure:
   - Storage rules are properly configured
   - Domain restrictions are set in Firebase Console (if needed)
   - API key restrictions are configured

3. **Cost Management**:
   - Monitor storage usage in Firebase Console
   - Consider implementing automatic cleanup of old videos
   - Set up billing alerts

## Monitoring

Monitor your Firebase Storage usage:
1. Go to Firebase Console → Storage
2. Check usage and costs
3. Set up billing alerts in Firebase Console → Usage and billing

## Troubleshooting

### Upload Fails with "Permission Denied"
- Check Firebase Storage rules
- Ensure rules allow writes to `pulltalk_videos/` path
- Verify file size is under 100MB

### Upload Fails with "Quota Exceeded"
- Check Firebase Storage quota in console
- Upgrade plan if needed
- Consider implementing cleanup of old videos

### Videos Not Accessible
- Check that storage rules allow public read access
- Verify the download URL is correct
- Check Firebase Console for any errors

## Next Steps

1. ✅ Configure Firebase Storage rules (see above)
2. ✅ Test upload functionality
3. ⚠️ Consider adding Firebase Authentication for production
4. ⚠️ Set up automatic cleanup of old videos
5. ⚠️ Monitor storage usage and costs

