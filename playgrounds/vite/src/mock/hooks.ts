import { failResponseWrap, successResponseWrap } from '@/utils/setup-mock';
import { definePlugin, FourzeApp, FourzeMiddleware, jsonWrapperHook } from '@fourze/core';


export default definePlugin((app)=>{
  app.use(jsonWrapperHook(successResponseWrap,failResponseWrap))
})
