import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],build:{rollupOptions:{output:{manualChunks:{vendor:['react','react-dom','@mui/material','@emotion/react','@emotion/styled'],firebaseFirestore:['firebase/firestore'],firebaseAuth:['firebase/auth'],firebaseStorage:['firebase/storage'],firebaseFunctions:['firebase/functions']}}}},server:{host:'127.0.0.1',port:3017,strictPort:true},resolve:{alias:{'@':new URL('./src',import.meta.url).pathname}}});
