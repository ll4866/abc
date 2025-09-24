const socket  = io();

let formElm   = document.querySelector("#chatForm");
console.log(formElm);
let msgInput  = document.querySelector("#newMessage");
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

// LISTEN FOR NEWLY TYPED MESSAGES, 
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

    //prevent blank messages
    if (!newMessage) return; 

    // write message
    appendMessage(userName, newMessage); 

    // send the newMessage to the server 1st
    socket.emit("message", {sender:userName, text:newMessage});

    // clear out input
    msgInput.value = "";
}

// LISTEN FOR NEW MESSAGES FROM SERVER
// APPEND THEM TO THE MESSAGE BOX
// AUTO SCROLL TO BOTTOM
socket.on("messsage-from-server", function(data){
    console.log(data);

    // prevent repetition of own message
    if (data.sender === userName) return; 

     // write message from server
    appendMessage(data.sender, data.text);
});

// APPEND MESSAGES TO BOX
function appendMessage(sender, txt){
    console.log(txt);
    //prevent weird unknwon undefined messages
    if (sender === 'unknown' || txt === undefined) return; 

    // select list (ul) first
    let chatThreadList = document.querySelector("#threadWrapper ul");
    console.log(chatThreadList);

    

    // create new list item (li)
    let newListItem = document.createElement("li");

    // if the message is from the server it would name the user and text message
    // if not it would swrite the message
    if (sender==='system'){
        newListItem.className='system';
        newListItem.textContent=txt;
    }else{
        // PICK SYSTEM
        // only when 'pick' is written
        if (sender !== 'system' && txt.trim().toLowerCase() === 'pick'){
            // collect every .words text (newest → oldest) and listing them in an array
            let allWords = Array.from(document.querySelectorAll('#threadWrapper li .words'))
                                .map(w => w.textContent || w.innerText);

            // from the list only the ones with the choices
            for (let i = allWords.length - 1; i >= 0; i--){
                let m = allWords[i];

                // extract [Title] block
                let matches = m.split('[').slice(1).map(s => s.split(']')[0]);

                // >1 list of []
                if (matches && matches.length >= 2){
                    // random pick from list
                    let titles = matches.map(s => s.trim());
                    let chosen = titles[Math.floor(Math.random() * titles.length)];
                    
                    // announce results
                    socket.emit('message', {sender:'system', text:'Suggestion: ' + chosen});
                    // only run once
                    break;   
                }
            }
        }
        
        newListItem.innerHTML='<img src="assets/profile.png" style="height:30px; border-radius:4px; vertical-align:middle; margin-left:6px;">' + '<span class="who">'+sender+':</span> <span class="words">'+txt+'</span>';
    }   

    // append new li to the list
    chatThreadList.append(newListItem);

    // scroll to bottom of textbox
    chatThreadList.scrollTop = chatThreadList.scrollHeight;
}