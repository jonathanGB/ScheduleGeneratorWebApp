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
          $('#wizard .content').addClass('pre-loader')
          $('#wizard .content > section').eq(1).hide()
          toastr.info('', 'Grabbing semesters...', {timeOut: 0})
        } else {
          signalError(currIndex, 'Bad credentials...');
        }
      })
    } else if (currIndex === 1) {

    } else {
      
    }
  })
  
  socket.on('grab semesters', function(data) {
    $('#wizard .content').removeClass('pre-loader');
    $('#wizard .content > section').eq(1).show();
    setTimeout(toastr.clear, 2000);
    
    if (!data)
      return toastr.error('', 'No semesters found...', {timeOut: 0})
      
    Object.keys(data).forEach(function(semester) {
      var semesterHTML = '<div class="checkbox">' +
                          '<label>' +
                            '<input type="checkbox" value="' + data[semester] + '">' + semester +
                          '</label>' +
                         '</div>';
      
      $('#semesters').append(semesterHTML);
    })
    console.log(data);
  })
  
  
  
  /* functions */
  function verifyCredentials(username, password, callback) {
    $('#loader').fadeIn(300);
    
    // change with real method
    socket.emit('verify credentials', {username, password}, function(status) {
      $('#loader').fadeOut(300);
      callback(status);
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