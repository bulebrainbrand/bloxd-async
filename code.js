
///////////////////////////////////
//////////    setting    //////////

const showLog = {
  error:true,
  warn:true,
  info:true,
  debug:true,
  assert:true
  }


///////////////////////////////////

var Logger = {
  error(obj,text){
    if(!showLog.error)return;
    const errorObj = Object.values(obj).find(data => data instanceof Error)
    console.log(`❌️[error] ${errorObj?.toString()??"not found error object"} \nstack:\n${errorObj?.stack??"stack not found"} \ndata:\n${JSON.stringify(obj,null,2)}`)
    },
  warn(obj,text){
    if(!showLog.warn)return;
    console.log(`🟧[warning] ${text} \ndata:\n${JSON.stringify(obj,null,2)}`)
    },
  info(obj,text){
    if(!showLog.info)return;
    console.log(`🟦[info] ${text} \ndata:\n${JSON.stringify(obj,null,2)}`)
    },
  debug(obj,text){
    if(!showLog.debug)return;
    console.log(`⬜️[debug] ${text} \ndata:\n${JSON.stringify(obj,null,2)}`)
    },
  assert(bool,text,obj){
    if(!showLog.assert)return;
    if(bool === false){ 
      console.log(`🫖[assert] ${text} \ndata:\n${obj?JSON.stringify(obj,null,2):"data not found"}`)
      }
    }

  }

var BlockDataIO = class{
  static write(pos,data){
    return new Promise((resolve,reject) => {
      waitLoadBlock(pos,resolve)
      })
    .then(() => api.setBlockData(...pos,{persisted:{shared:{data}}}))
    }
  static read(pos){
    return new Promise((resolve,reject) => {
      waitLoadBlock(pos,resolve)
      })
    .then(() => api.getBlockData(...pos)?.persisted?.shared?.data)
    }
  }

const waitLoadBlockGene = function* (pos,resolve){
  if(!resolve)throw new TypeError("waitLoadBlockGene need resolve")
  while(!api.isBlockInLoadedChunk(...pos)){
    api.getBlock(pos)
    yield;
    }
  resolve()
  }

const waitLoadBlock = (pos,resolve) => {
  runningGenes.push(waitLoadBlockGene(pos,resolve))
  }


var Promise = class{

  constructor(callback){
    this.state = "pending"
    this.value = undefined
    this.reason = undefined
    this.handlers = []
    const resolve = (value) => {
      if(value instanceof Promise){
        value.then(resolve,reject)
        return
        }
      this.value = value
      this.state = "fulfilled"
      this._runHandlers()
      }
    const reject = (reason) => {
      this.reason = reason
      this.state = "rejected"
      this._runHandlers()
      }

    try{
      callback(resolve,reject)
      }
    catch(e){
      reject(e)
      }
    }
  _runHandlers(){
    if(this.state === "pending")return;
    queueMicrotask(() => {
      for(const {onFulfilled,onRejected} of this.handlers){
        if(this.state === "fulfilled" && onFulfilled){
          onFulfilled(this.value)
          continue;
          }
        if(this.state === "rejected" && onRejected){
          onRejected(this.reason)
          continue;
          }
        }
      this.handlers = []
      })
    }

  then(onFulfilled,onRejected){
    return new Promise((resolve,reject) => {
      const handler = {
        onFulfilled:onFulfilled ? (value) => {
          try{
            const result = onFulfilled(value)
            this._handleResolution(result,resolve,reject)
          }catch(error){
            reject(error)
          }}:resolve,
        onRejected:onRejected ? (reason) => {
          try{
            const result = onRejected(reason)
            this._handleResolution(result,resolve,reject)
          }catch(error){
            reject(error)
          }}:reject
        }
      this.handlers.push(handler)
      if(this.state !== 'pending')this._runHandlers();
      })
    }
  
  catch(onRejected){
    return this.then(null,onRejected)
    }

  _handleResolution(result,resolve,reject){
    if(this === result)throw new TypeError("do not return this in then/catch")
    if(result instanceof Promise){
      result.then(resolve,reject)
      }
    else{
      resolve(result)
      }
    }

  static resolve(value){
    return value instanceof Promise?value:new Promise((resolve) => resolve(value))
    }

  static all(promises = []){
    const arrayPromise = [...promises]
    if(arrayPromise.length === 0)return Promise.resolve([]);
    return new Promise((resolve,reject) => {
      let data = []
      const amount = arrayPromise.length
      let resolveAmount = 0
      let rejected = false
      for(const [i,promise] of arrayPromise.map(Promise.resolve).entries()){
        promise.then(value => {
          if(rejected)return;
          resolveAmount++
          data[i] = value
          if(amount === resolveAmount)resolve(data);
          },
        e => {
          if(rejected)return;
          rejected = true
          reject(e)
          })
        }
      })
    }
  }


let microtaskQueue = []

let macrotaskQueue = []

let timeoutQueue = []

let runningGenes = []

let callStack = []

var queueMicrotask = (callback) => {
if(typeof callback !== "function"){
  Logger.error({value:callback},"[queueMicrotask] do not add not function value")
  throw new TypeError("[queueMicrotask] do not add not function value")
  }
microtaskQueue.push(callback)
};

var setTimeout = (func,time,...args) => {
  const funcRunTime = api.now() + time
  add: {
    for(let i = 0;i<timeoutQueue.length;i++){
      const {runTime} = timeoutQueue[i]
      if(funcRunTime <= runTime){
        timeoutQueue.splice(i,0,{runTime:funcRunTime,func,interval:null,args})
        break add;
        }
      }
    timeoutQueue.push({runTime:funcRunTime,func,interval:null,args})
    }
  }

var setInterval = (func,interval,...args) => {
  const funcRunTime = api.now() + interval
  add: {
    for(let i = 0;i<timeoutQueue.length;i++){
      const {runTime} = timeoutQueue[i]
      if(funcRunTime < runTime){
        timeoutQueue.splice(i,0,{runTime:funcRunTime,func,interval,args})
        break add;
        }
      }
    timeoutQueue.push({runTime:funcRunTime,func,interval,args})
    }
  }

tick = () => {
  if(callStack.length > 0){
    callStack = callStack.filter(func => {
      try{
        func()
        }catch(e){Logger.error({e},"callStackRunner")}
      return false
      })
    }
  if(callStack.length === 0){
    callStack.push(...microtaskQueue)
    }
  if(callStack.length === 0 && runningGenes.length > 0){
    callStack.push(() => {runningGenes.filter(gene => {
      try{return !gene.next().done}
      catch(e){
        Logger.error({e},"runningGenes")
        return false
        }
      })})
    }
  if(callStack.length === 0 && macrotaskQueue.length > 0){
    callStack.push(macrotaskQueue[0])
    macrotaskQueue.shift()
    }
  const now = api.now()
  while(timeoutQueue.length !== 0){
    if(timeoutQueue[0].runTime > now)break;
    const {runTime,func,interval,args} = timeoutQueue[0]
    if(interval != null){
      setInterval(func,interval,...args)
      }
      macrotaskQueue.push(() => {
        try{func()}catch(e){Logger.error({e},"setTimeout/setInterval")}
        })
    timeoutQueue.shift()
    }
  }
