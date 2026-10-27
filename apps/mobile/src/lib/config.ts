// Inloggning med e-postkod är avstängd tills vidare. Appen loggar då in
// varje enhet anonymt, så att databasens behörighetsregler (auth.uid())
// fungerar som vanligt. Sätt EXPO_PUBLIC_LOGIN_ENABLED=true för att slå på
// inloggningssidan igen; ett anonymt konto kan då kopplas till en e-post
// (supabase.auth.updateUser({ email })) så att källaren följer med.
export const LOGIN_ENABLED = process.env.EXPO_PUBLIC_LOGIN_ENABLED === "true";
