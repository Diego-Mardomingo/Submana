import React, { useState } from "react";
import { toast, Toaster } from "@pheralb/toast";

export default function ShowToast() {

  const params = new URLSearchParams(window.location.search);
  const success = params.get('success');
  const method = params.get('method');

  if(success === 'true'){
    if(method === 'insert'){
      toast.success({
        text: 'New subscription created successfully! 🎉',
        delayDuration: 8000
      });
    }else if(method === 'get'){
      toast.success({
        text: 'Subscriptions retrieved successfully! 🎉',
        delayDuration: 8000
      });
    }else if(method === 'delete'){
      toast.success({
        text: 'Subscription deleted successfully! 🎉',
        delayDuration: 8000
      });
    }
  }else if(success === 'false'){
    toast.error({
      text: 'An error has ocurred 😱'
    });
  }

  // Limpieza de URL
  if (window.location.search) {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, document.title, url.pathname);
  }

  return (
    <Toaster position="top-center" theme="dark" client:load/>
  );

}
