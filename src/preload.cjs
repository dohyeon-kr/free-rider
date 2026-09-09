const {contextBridge,ipcRenderer}=require('electron');
const api={};for(const name of ['import-spec','sync-spec','merge-spec','send','cancel','clear-tokens','import-env','open-collection','save-collection','git-open','git-status','git-save','git-diff','git-commit'])api[name]=(...args)=>ipcRenderer.invoke(name,...args);
contextBridge.exposeInMainWorld('client',api);
