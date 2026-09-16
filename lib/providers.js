import { AppError } from './network.js';

export const providers = Object.freeze([
 {id:'openai',name:'OpenAI',base:'https://api.openai.com/v1'},
 {id:'anthropic',name:'Anthropic / Claude',base:'https://api.anthropic.com/v1',kind:'anthropic'},
 {id:'openrouter',name:'OpenRouter',base:'https://openrouter.ai/api/v1'},
 {id:'groq',name:'Groq',base:'https://api.groq.com/openai/v1'},
 {id:'xai',name:'xAI / Grok',base:'https://api.x.ai/v1'},
 {id:'gemini',name:'Google Gemini',base:'https://generativelanguage.googleapis.com/v1beta/openai'},
 {id:'deepseek',name:'DeepSeek',base:'https://api.deepseek.com/v1'},
 {id:'mistral',name:'Mistral',base:'https://api.mistral.ai/v1'}
]);
// Local hints, not credential validation. Never probe providers to identify a key.
export function detectProvider(value){
 const key=String(value||'').trim();
 if(/^sk-ant-api\d+-/.test(key))return 'anthropic';
 if(/^sk-or-v1-/.test(key))return 'openrouter';
 if(/^sk-(proj|svcacct)-/.test(key))return 'openai';
 if(/^gsk_/.test(key))return 'groq';
 if(/^xai-/.test(key))return 'xai';
 // Legacy sk- keys overlap; AIza keys can belong to other Google services.
 return null;
}
export function selectProvider(id,key){
 if(/^sk-(admin-|ant-admin)/.test(key.trim()))throw new AppError('Use a model API key, not an administrative key.');
 const detected=detectProvider(key);
 if(detected&&id&&id!==detected)throw new AppError('The selected provider does not match this key’s recognizable prefix. Choose the matching provider.');
 const provider=providers.find(p=>p.id===(id||detected));
 if(!provider)throw new AppError('This key’s provider is ambiguous. Choose its provider from the dropdown; no key has been sent.');
 return provider;
}
export function providerHeaders(provider,key){
 return provider.kind==='anthropic'?{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}:{Authorization:`Bearer ${key}`};
}
