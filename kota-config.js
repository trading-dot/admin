/* Konfigurasi Firebase untuk panel Kota. STORE = project toko (sama dengan auth.js). CITY = project baru "city": isi dari Firebase Console. */
export const STORE = { apiKey: "AIzaSyCVL_C4opQiKC6fNG_Rw4l-519rQZICH58", authDomain: "fvcktherules-store.firebaseapp.com", projectId: "fvcktherules-store", storageBucket: "fvcktherules-store.firebasestorage.app", messagingSenderId: "382347904485", appId: "1:382347904485:web:6715a7b395d44ad07a5b0c" };
export const CITY = { apiKey: "AIzaSyDphf7cMy_Qlbjfr3kzmWtvhq13vvzwKUw", authDomain: "city-fucktherules.firebaseapp.com", projectId: "city-fucktherules", storageBucket: "city-fucktherules.firebasestorage.app", messagingSenderId: "143997546650", appId: "1:143997546650:web:ecc8c22ad98446bc18ef23" };
export const cityReady = () => !!CITY.projectId;

export const CLOUD = { cloud: "dpkmdjfbt", preset: "gloriam-galeri", folder: "fttr-city" };
