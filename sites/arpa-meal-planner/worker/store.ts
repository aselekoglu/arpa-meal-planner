import { convertAmount, isApprovedMeasureLabel } from '../src/lib/units.js';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(message:string):never { throw new HttpError(400,message); }
function object(raw:unknown):Record<string,any> { if(!raw||typeof raw!=='object'||Array.isArray(raw))fail('Expected an object'); return raw as Record<string,any>; }
function text(raw:unknown,max=500):string { if(typeof raw!=='string'||!raw.trim()||raw.length>max)fail('Invalid text');return raw.trim(); }
function number(raw:unknown,min=0,max=1_000_000):number { if(typeof raw!=='number'||!Number.isFinite(raw)||raw<min||raw>max)fail('Invalid number');return raw; }
function id(raw:unknown):number { const n=number(raw,1,Number.MAX_SAFE_INTEGER);if(!Number.isInteger(n))fail('Invalid ID');return n; }
function servings(raw:unknown):number {const n=number(raw,1,100);if(!Number.isInteger(n))fail('Invalid servings');return n;}
export function validDate(raw:unknown):string { const d=text(raw,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||(!Number.isFinite(Date.parse(d+'T00:00:00Z'))||new Date(d+'T00:00:00Z').toISOString().slice(0,10)!==d))fail('Invalid date');return d; }
function optionalUrl(raw:unknown):string|null { if(raw==null||raw==='')return null;const s=text(raw,2000);if(/^\/api\/images\/[a-zA-Z0-9/_-]+\.[a-z]+$/.test(s))return s;try{const u=new URL(s);if(u.protocol==='https:'&&!u.username&&!u.password)return s;}catch{}fail('Expected a safe HTTPS or private image URL'); }
export function validateMeal(raw:unknown, legacyMeasures:ReadonlySet<string>=new Set()) {
  const b=object(raw);const name=text(b.name);const tag=typeof b.tag==='string'?b.tag.trim().slice(0,200):'';
  if(!Array.isArray(b.ingredients)||!b.ingredients.length||b.ingredients.length>200)fail('ingredients must contain 1–200 entries');
  const ingredients=b.ingredients.map((row:unknown)=>{const i=object(row);const measure=text(i.measure,80);if(!isApprovedMeasureLabel(measure)&&!legacyMeasures.has(measure))fail('Invalid measure');return {name:text(i.name),amount:number(i.amount),measure,calories:number(i.calories??0),protein:number(i.protein??0),fat:number(i.fat??0),carbs:number(i.carbs??0)};});
  let instructions:string[]=[];if(b.instructions!=null&&b.instructions!==''){const rows=typeof b.instructions==='string'?JSON.parse(b.instructions):b.instructions;if(!Array.isArray(rows)||rows.length>100)fail('Invalid instructions');instructions=rows.map((r:unknown)=>text(r,5000));}
  return {name,tag,servings:servings(b.servings??4),instructions,image_url:optionalUrl(b.image_url),source_url:optionalUrl(b.source_url),ingredients};
}
type Guard={sql:string,args:unknown[]};
export class KitchenStore {
  constructor(public db:D1Database){}
  private stmt(sql:string,...args:unknown[]){return this.db.prepare(sql).bind(...args);}
  async listMeals():Promise<any[]> {
    const [m,i]=await Promise.all([this.stmt("SELECT * FROM meals WHERE family_id='default' ORDER BY id").all<any>(),this.stmt("SELECT i.* FROM ingredients i JOIN meals m ON m.id=i.meal_id WHERE m.family_id='default' ORDER BY i.id").all<any>()]);
    return m.results.map(r=>({...r,instructions:JSON.parse(r.instructions||'[]'),ingredients:i.results.filter(ing=>ing.meal_id===r.id)}));
  }
  async getMeal(mealId:number):Promise<any|null>{id(mealId);return(await this.listMeals()).find(m=>m.id===mealId)??null;}
  async listPantry():Promise<any[]>{return(await this.stmt("SELECT * FROM pantry WHERE family_id='default' ORDER BY name COLLATE NOCASE,id").all<any>()).results;}
  async listPlanner(startDate?:string,endDate?:string):Promise<any[]>{let where="p.family_id='default' AND m.family_id='default'";const args:unknown[]=[];if(startDate){where+=' AND p.date>=?';args.push(validDate(startDate));}if(endDate){where+=' AND p.date<=?';args.push(validDate(endDate));}return(await this.stmt(`SELECT p.*,m.name as meal_name FROM planner p JOIN meals m ON p.meal_id=m.id WHERE ${where} ORDER BY p.date,p.id`,...args).all<any>()).results;}
  private mealStatements(raw:unknown,key:string,guard?:Guard):D1PreparedStatement[]{
    const m=validateMeal(raw);const suffix=guard?' WHERE '+guard.sql:'';const ga=guard?.args??[];
    const statements=[this.stmt(`INSERT INTO meals(family_id,name,tag,instructions,source_url,image_url,servings,operation_key) SELECT 'default',?,?,?,?,?,?,?${suffix}`,m.name,m.tag,JSON.stringify(m.instructions),m.source_url,m.image_url,m.servings,key,...ga)];
    for(const i of m.ingredients)statements.push(this.stmt(`INSERT INTO ingredients(meal_id,name,amount,measure,calories,protein,fat,carbs) SELECT id,?,?,?,?,?,?,? FROM meals WHERE operation_key=?${guard?' AND '+guard.sql:''}`,i.name,i.amount,i.measure,i.calories,i.protein,i.fat,i.carbs,key,...ga));
    return statements;
  }
  async createMeal(body:unknown){const key=crypto.randomUUID();const r=await this.db.batch(this.mealStatements(body,key));return{id:r[0].meta.last_row_id,success:true};}
  async updateMeal(mealId:number,body:unknown){id(mealId);const current=await this.getMeal(mealId);if(!current)throw new HttpError(404,'Meal not found');const m=validateMeal(body,new Set<string>(current.ingredients.map((i:any)=>i.measure)));const statements=[this.stmt("UPDATE meals SET name=?,tag=?,instructions=?,source_url=?,image_url=?,servings=? WHERE id=? AND family_id='default'",m.name,m.tag,JSON.stringify(m.instructions),m.source_url,m.image_url,m.servings,mealId),this.stmt("DELETE FROM ingredients WHERE meal_id=? AND EXISTS(SELECT 1 FROM meals WHERE id=? AND family_id='default')",mealId,mealId)];for(const i of m.ingredients)statements.push(this.stmt("INSERT INTO ingredients(meal_id,name,amount,measure,calories,protein,fat,carbs) SELECT id,?,?,?,?,?,?,? FROM meals WHERE id=? AND family_id='default'",i.name,i.amount,i.measure,i.calories,i.protein,i.fat,i.carbs,mealId));const r=await this.db.batch(statements);if(!r[0].meta.changes)throw new HttpError(404,'Meal not found');return{success:true};}
  async setMealImage(mealId:number,imageUrl:string){return this.changed("UPDATE meals SET image_url=? WHERE id=? AND family_id='default'",optionalUrl(imageUrl),id(mealId));}
  private async changed(sql:string,...args:unknown[]){const r=await this.stmt(sql,...args).run();if(!r.meta.changes)throw new HttpError(404,'Record not found');return{success:true};}
  deleteMeal(mealId:number){return this.changed("DELETE FROM meals WHERE id=? AND family_id='default'",id(mealId));}
  async addPlanner(raw:unknown){const b=object(raw);const mealId=id(b.meal_id);const date=validDate(b.date);const s=b.servings_override==null||b.servings_override===''?null:servings(b.servings_override);const r=await this.stmt("INSERT INTO planner(family_id,date,meal_id,servings_override) SELECT 'default',?,id,? FROM meals WHERE id=? AND family_id='default'",date,s,mealId).run();if(!r.meta.changes)throw new HttpError(404,'Meal not found');return{id:r.meta.last_row_id,success:true};}
  deletePlanner(rowId:number){return this.changed("DELETE FROM planner WHERE id=? AND family_id='default'",id(rowId));}
  movePlanner(rowId:number,date:unknown){return this.changed("UPDATE planner SET date=? WHERE id=? AND family_id='default'",validDate(date),id(rowId));}
  setPlannerServings(rowId:number,s:unknown){return this.changed("UPDATE planner SET servings_override=? WHERE id=? AND family_id='default'",s==null||s===''?null:servings(s),id(rowId));}
  private pantryInput(raw:unknown){const b=object(raw);const measure=text(b.measure,80);if(!isApprovedMeasureLabel(measure))fail('Invalid measure');return{name:text(b.name,200),amount:number(b.amount),measure};}
  async addPantry(raw:unknown){const b=this.pantryInput(raw);const r=await this.stmt("INSERT INTO pantry(family_id,name,amount,measure) VALUES('default',?,?,?)",b.name,b.amount,b.measure).run();return{id:r.meta.last_row_id,success:true};}
  async updatePantry(raw:unknown){const b=object(raw);const p=this.pantryInput(b);let target=b.id===undefined?undefined:id(b.id);if(!target){const old=await this.stmt("SELECT id FROM pantry WHERE family_id='default' AND lower(name)=lower(?) AND measure=? ORDER BY id LIMIT 1",p.name,p.measure).first<any>();target=old?.id;}if(!target)return this.addPantry(p);await this.changed("UPDATE pantry SET name=?,amount=?,measure=? WHERE id=? AND family_id='default'",p.name,p.amount,p.measure,target);return{id:target,success:true};}
  deletePantry(rowId:number){return this.changed("DELETE FROM pantry WHERE id=? AND family_id='default'",id(rowId));}
  async mergeIngredientNames(raw:unknown){
    const b=object(raw);const target=text(b.targetName,200);
    if(!Array.isArray(b.sourceNames)||!b.sourceNames.length||b.sourceNames.length>100)fail('Invalid sourceNames');
    const sources=[...new Set<string>(b.sourceNames.map((v:unknown)=>text(v,200)))];
    const rows=(await this.listPantry()).filter(r=>r.name===target||sources.includes(r.name));
    const clusters:Array<{keep:any;rows:Array<{id:number;measure:string;factor:number}>}>=[];
    for(const row of rows){
      let cluster=clusters.find(c=>convertAmount(1,row.measure,c.keep.measure,target)!==null);
      if(!cluster){cluster={keep:row,rows:[]};clusters.push(cluster);}
      cluster.rows.push({id:row.id,measure:row.measure,factor:convertAmount(1,row.measure,cluster.keep.measure,target)??1});
    }
    const placeholders=sources.map(()=>'?').join(',');
    const statements=[
      this.stmt(`UPDATE ingredients SET name=? WHERE name IN(${placeholders}) AND meal_id IN(SELECT id FROM meals WHERE family_id='default')`,target,...sources),
      this.stmt(`UPDATE pantry SET name=? WHERE name IN(${placeholders}) AND family_id='default'`,target,...sources),
    ];
    const deleteIndices:number[]=[];
    for(const cluster of clusters){
      const filters=cluster.rows.map(()=>'(id=? AND measure=?)').join(' OR ');
      const filterArgs=cluster.rows.flatMap(r=>[r.id,r.measure]);
      const factors=cluster.rows.map(()=> 'WHEN ? THEN ?').join(' ');
      const factorArgs=cluster.rows.flatMap(r=>[r.id,r.factor]);
      // Quantities are read inside the atomic batch, not copied from the earlier grouping query.
      statements.push(this.stmt(`UPDATE pantry SET amount=ROUND((SELECT SUM(amount * CASE id ${factors} ELSE 1 END) FROM pantry WHERE family_id='default' AND (${filters})),4) WHERE id=? AND measure=? AND family_id='default'`,...factorArgs,...filterArgs,cluster.keep.id,cluster.keep.measure));
      for(const row of cluster.rows.filter(r=>r.id!==cluster.keep.id)){deleteIndices.push(statements.length);statements.push(this.stmt("DELETE FROM pantry WHERE id=? AND measure=? AND family_id='default' AND EXISTS(SELECT 1 FROM pantry WHERE id=? AND measure=? AND family_id='default')",row.id,row.measure,cluster.keep.id,cluster.keep.measure));}
    }
    const r=await this.db.batch(statements);
    return{success:true,updatedIngredientRows:r[0].meta.changes,updatedPantryRows:r[1].meta.changes,consolidatedPantryRows:deleteIndices.reduce((n,i)=>n+r[i].meta.changes,0)};
  }
  private planStatements(startDate:string,meals:unknown[],key:string,guard?:Guard){const start=validDate(startDate);if(!Array.isArray(meals)||meals.length!==7)fail('Exactly seven meals required');const statements:D1PreparedStatement[]=[];meals.forEach((meal,i)=>{const op=key+':'+i;statements.push(...this.mealStatements(meal,op,guard));const date=new Date(start+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+i);statements.push(this.stmt(`INSERT INTO planner(family_id,date,meal_id) SELECT 'default',?,id FROM meals WHERE operation_key=?${guard?' AND '+guard.sql:''}`,date.toISOString().slice(0,10),op,...guard?.args??[]));});return statements;}
  async saveGeneratedPlan(startDate:string,meals:unknown[],operationId=crypto.randomUUID()){await this.db.batch(this.planStatements(startDate,meals,operationId));return{success:true};}
  async createPreview(owner:string,kind:'weekly-plan'|'recipe-import',payload:unknown){if(kind==='weekly-plan'){const p=object(payload);this.planStatements(p.startDate,p.meals,'validation');}else validateMeal(payload);const json=JSON.stringify(payload);if(json.length>900000)fail('Preview too large');const previewId=crypto.randomUUID();await this.stmt('INSERT INTO mcp_previews(id,owner_id,kind,payload,expires_at) VALUES(?,?,?,?,?)',previewId,text(owner,200),kind,json,Date.now()+600000).run();return{previewId,expiresInSeconds:600,preview:payload};}
  private async commitPreview(owner:string,previewId:string,kind:'weekly-plan'|'recipe-import'){text(previewId,100);text(owner,200);const now=Date.now();const guard={sql:'EXISTS(SELECT 1 FROM mcp_previews WHERE id=? AND owner_id=? AND kind=? AND expires_at>? AND consumed_at IS NULL)',args:[previewId,owner,kind,now]};const preview=await this.stmt('SELECT payload FROM mcp_previews WHERE id=? AND owner_id=? AND kind=? AND expires_at>? AND consumed_at IS NULL',...guard.args).first<any>();if(!preview)throw new HttpError(404,'Preview not found or expired');const payload=JSON.parse(preview.payload);const statements=kind==='weekly-plan'?this.planStatements(payload.startDate,payload.meals,'preview:'+previewId,guard):this.mealStatements(payload,'preview:'+previewId,guard);statements.push(this.stmt('UPDATE mcp_previews SET consumed_at=? WHERE id=? AND owner_id=? AND kind=? AND expires_at>? AND consumed_at IS NULL',now,...guard.args));const r=await this.db.batch(statements);if(!r[r.length-1].meta.changes)throw new HttpError(409,'Preview already consumed or expired');return{success:true,...(kind==='recipe-import'?{id:r[0].meta.last_row_id}:{})};}
  commitPlanPreview(owner:string,previewId:string){return this.commitPreview(owner,previewId,'weekly-plan');}
  saveRecipePreview(owner:string,previewId:string){return this.commitPreview(owner,previewId,'recipe-import');}
}
