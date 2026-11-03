// Server-only request context. Never retain a bearer or recipient details here.
export const creatorInvitationHome = Symbol('Gold Trails pending creator invitation homepage');
export const creatorInvitationFlow = Symbol('Gold Trails pending creator account setup');
export const creatorAccessRoutes = new Set(['/signup/','/login/','/account/','/logout/','/verify-email/','/resend-verification/','/forgot-password/','/reset-password/']);

// This readable cookie selects an invitation page, never an authenticated account.
export const creatorNameSlug=value=>typeof value==='string'&&value.length<=160&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export function creatorInvitationName(req){
 const value=(req.headers.cookie||'').match(/(?:^|;\s*)__Host-gold-creator-name=([^;]+)(?:;|$)/)?.[1];
 return creatorNameSlug(value)?value:null;
}
