import test from "node:test";
import assert from "node:assert/strict";
import {validateReview} from "../assets/testimonial-validation.js";

test("testimonials require a genuine customer name and substantial review",()=>{
 assert.equal(validateReview({name:"A",message:"Great service",rating:5}).ok,false);
 assert.equal(validateReview({name:"Customer",message:"Too brief",rating:5}).ok,false);
});
test("ratings are either absent or an integer from 1 to 5",()=>{
 assert.equal(validateReview({name:"Customer",message:"I received a careful quote comparison.",rating:6}).ok,false);
 assert.equal(validateReview({name:"Customer",message:"I received a careful quote comparison.",rating:4.5}).ok,false);
 assert.equal(validateReview({name:"Customer",message:"I received a careful quote comparison.",rating:""}).data.rating,null);
});
test("valid review is normalized without inventing approval",()=>{
 const v=validateReview({name:" Client One ",company:" Example Ltd ",message:" Helpful support and clear updates on our order. ",rating:"5"});
 assert.deepEqual(v,{ok:true,data:{name:"Client One",company:"Example Ltd",message:"Helpful support and clear updates on our order.",rating:5}});
 assert.equal(Object.hasOwn(v.data,"approved"),false);
});
