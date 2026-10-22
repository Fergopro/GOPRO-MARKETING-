export function validateReview(data){
 const name=String(data?.name??"").trim(),company=String(data?.company??"").trim(),message=String(data?.message??"").trim();
 const rating=data?.rating===""||data?.rating==null?null:Number(data.rating);
 const fail=error=>({ok:false,error});
 if(name.length<2||name.length>120)return fail("Name must contain 2–120 characters.");
 if(company.length>160)return fail("Company must be no longer than 160 characters.");
 if(message.length<10||message.length>2000)return fail("Review must contain 10–2,000 characters.");
 if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>5))return fail("Rating must be between 1 and 5.");
 return {ok:true,data:{name,company,message,rating}};
}
