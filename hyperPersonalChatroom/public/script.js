const socket = io();

let formElm = document.querySelector("#chatForm");
console.log(formElm);
let msgInput = document.querySelector("#newMessage");
console.log(msgInput);

let nameInput = document.querySelector("#nameWrapper input");
let nameTag   = document.querySelector("#nameWrapper p");
let userName  = "";

document.getElementById("nameBtn").addEventListener("click", function(){
    // lock the chosen name and swap controls for plain text
    let trimmed = nameInput.value.trim();
    if(!trimmed) return;
    userName = trimmed;

    // replace with fixed label 
    nameWrapper.innerHTML = '<span style="position:fixed; top:95px; left:5px; color:white; font-weight:bold;">' + 'User: ' + userName + '</span>';

    // announcement
    socket.emit('message', {sender:'system', text:userName + ' entered the chat'});
});

// LISTEN FOR NEWLY TYPEd MESSAGES, 
// SEND THEM TO THE SERVER
formElm.addEventListener("submit", newMessageSubmitted);

function newMessageSubmitted(event){
    console.log(event);
    // stop form element from refreshing the page
    event.preventDefault();

    // must have a user name to send message
    if(!userName) return;  

    // message
    let newMessage = msgInput.value
    console.log(newMessage);
    if (!newMessage) return; //prevent blank messages
    appendMessage(userName, newMessage); 

    // send the newMessage to the server 1st
    socket.emit("message", {sender:userName, text:newMessage});

    // clear out input
    msgInput.value = "";
}

// LISTEN FOR NEW MESSAGES FROM SERVER
// APPEND THEM TO THE MESSAGE BOX
// AUTO SCROLL TO BOTTOM
socket.on("newMessage", function(data){
    if (data.sender === userName) return;
    appendMessage(data.sender, data.text);
});

// APPEND MESSAGES TO BOX
function appendMessage(sender, txt){
    //prevent weird unknwon undefined messages
    if (sender === 'unknown' || txt === undefined) return; 

    console.log(txt);
    // select list (ul) first
    let chatThreadList = document.querySelector("#threadWrapper ul");
    console.log(chatThreadList);

    // create new list item (li)
    let newListItem = document.createElement("li");
    if (sender==='system'){                         // entry line
        newListItem.className='system';
        newListItem.textContent=txt;
    }else{                                          // chat line
        newListItem.innerHTML='<img src="assets/profile.png" style="height:30px; border-radius:4px; vertical-align:middle; margin-left:6px;">' + '<span class="who">'+sender+':</span> <span class="words">'+txt+'</span>';
    }   

    // append new li to the list
    chatThreadList.append(newListItem);

    // scroll to bottom of textbox
    chatThreadList.scrollTop = chatThreadList.scrollHeight;
}