export function memberMail(env=process.env,send=fetch){
 if(!env.RESEND_API_KEY||!env.MEMBER_MAIL_FROM||/[\r\n]/.test(env.MEMBER_MAIL_FROM))return null;
 return async({to,purpose,url})=>{const verify=purpose==='verify_email';const subject=verify?'Verify your Gold Trails email':'Reset your Gold Trails password';const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.MEMBER_MAIL_FROM,to:[to],subject,text:`${subject}\n\n${url}\n\nThis link expires ${verify?'in 24 hours':'in 30 minutes'}. If you did not request this, ignore this message.`}),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Member email unavailable');};
}
