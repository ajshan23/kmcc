import admin from "firebase-admin";
import serviceAccount from "./kmcc-riyadh-app-firebase-adminsdk-fbsvc-1f13d464b0.json";
// const serviceAccount = {

// } as admin.ServiceAccount;
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

export { admin };

