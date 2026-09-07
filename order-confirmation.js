import { supabase } from "./supabase.js";
const id=new URLSearchParams(location.search).get("order")||localStorage.getItem("pompkin_last_order_id");
const number=document.getElementById("confirmationNumber");
if(id){const {data}=await supabase.from("pompkin_orders").select("order_number").eq("id",id).maybeSingle();if(data?.order_number)number.textContent=data.order_number;document.getElementById("viewOrder").href=`order-status.html?order=${encodeURIComponent(id)}`;}
