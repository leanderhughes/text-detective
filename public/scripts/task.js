$('.start-task-for-all').on('click',function(){
    console.log({taskId:this.dataset.taskId});
    socket.emit('start-task-for-all',{taskId:this.dataset.taskId});
});

