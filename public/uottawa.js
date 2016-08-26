$(function() {
  var socket = io();
  var wizard = $('#wizard');
  
  wizard.steps({
    headerTag: "h3",
    bodyTag: "section",
    transitionEffect: "slideLeft",
    enablePagination: false,
    autoFocus: true,
    forceMoveForward: true,
    onInit: function() {
      wizard.fadeIn('slow')
    }
  });
  
  $('.submit [role=submit]').click(function() {
    var currIndex = $(this).data('index');
    
    if (currIndex === 0) {
      var username = $('#uozoneUsername').val();
      var password = $('#uozonePassword').val();
        
      if (!username || !password) {
        signalError(currIndex, 'At least one field is incomplete...');
        return false;
      }
          
      verifyCredentials(username, password, function(ok) {
        if (ok) {
          wizard.steps('next');
          toastr.success('', 'Good credentials!')
        } else {
          signalError(currIndex, 'Bad credentials...');
        }
      })
    } else if (currIndex === 1) {

    } else {
      
    }
  })
  
  
  
  /* functions */
  function verifyCredentials(username, password, callback) {
    $('#loader').fadeIn(300);
    
    // change with real method
    socket.emit('verify credentials', {username, password}, function(response) {
      $('#loader').fadeOut(300);
      callback(response.status);
    })
  }
  
  function signalError(ind, errMessage) {
    wizard.find(".steps li").eq(ind).addClass("error");
    toastr.error('', errMessage)
  }
  
  
  /* options */
  toastr.options = {
    "closeButton": false,
    "debug": false,
    "newestOnTop": false,
    "progressBar": false,
    "positionClass": "toast-top-right",
    "preventDuplicates": false,
    "onclick": null,
    "showDuration": "300",
    "hideDuration": "1000",
    "timeOut": "2000",
    "extendedTimeOut": "1000",
    "showEasing": "swing",
    "hideEasing": "linear",
    "showMethod": "fadeIn",
    "hideMethod": "fadeOut"
  }
});
