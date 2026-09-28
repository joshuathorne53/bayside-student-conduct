# Bayside College Student Conduct Register

A GitHub Pages application for recording, reviewing and actioning uniform and phone breaches.

## Live site

<https://joshuathorne53.github.io/bayside-student-conduct/>

## Architecture

- **Website:** GitHub Pages, served from `docs/`
- **Authentication:** Firebase Authentication with Google Sign-In
- **Database:** Cloud Firestore in Melbourne (`australia-southeast2`)
- **Security:** Firestore Security Rules enforce verified Bayside staff email domains

The Firebase web API key in `docs/firebase-config.js` identifies the Firebase project and is intentionally public. Database access is controlled by Firebase Authentication and `firestore.rules`, not by hiding the configuration.

## Features

- Google sign-in exclusively for `@baysidecc.vic.edu.au` staff
- Real-time uniform and phone breach register
- Uniform escalation calculated atomically from distinct breach dates
- Parent/carer email drafts
- Homegroup and status filtering
- Per-teacher default action homegroup, synced across devices
- Durable actioned tracking with staff attribution
- Responsive mobile and desktop interface

## Firebase project

Project ID: `bayside-conduct-register`

```bash
firebase deploy --only auth,firestore:rules,firestore:indexes
```

Firestore deletion protection is enabled. The supplied 298-student roster is stored in the protected `students` collection with `name`, `homegroup` and `active` fields. It is intentionally not committed to this public repository.

## GitHub Pages

The `main` branch publishes the `/docs` directory. Pushing changes to files in `docs/` automatically rebuilds the live site.
