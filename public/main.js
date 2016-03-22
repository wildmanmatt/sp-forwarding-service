function errMsg(msg) {
  return '<div class="alert alert-danger" role="alert"> '
    + '<strong>Oh snap!</strong> ' + msg + '</div>';
}

function getDomain() {
  $('#get_inbound_webhook').text('not configured');
  $('#set_domain').show();
}

function addWebhook(domain) {
  $('#add_webhook').show();
  $.ajax({
    type: 'POST',
    url: '/inbound-webhook',
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify({ domain: domain }),
    success: function(data){
      $('#add_inbound_webhook').html(
        'webhook target is <span style="font-family:monospace">'
          + data.app_url + '</span>');
    },
    error: function(jqXHR) {
      $('#rowcont').prepend(errMsg(jqXHR.responseText));
    }
  });
}

// Initially look for an existing webhook
$.ajax({
  type: 'GET',
  url: '/inbound-webhook',
  dataType: 'json',
  success: function(data) {
    $('#get_inbound_webhook').html(
      'target: <span style="font-family:monospace">' + data.app_url + '</span><br>' +
      'domain: <span style="font-family:monospace">' + data.domain + '</span>'
      );
  },
  error: function(jqXHR) {
    if (jqXHR.status === 404) {
      getDomain();
    }
    else {
      $('#rowcont').prepend(errMsg(jqXHR.responseText));
    }
  }
});

$(document).ready('#domain_form').submit(function(event) {
  event.preventDefault();
  let domain = $('input').val();
  $('.alert').remove();

  $.ajax({
    type: 'POST',
    url: '/inbound-domain',
    dataType: 'json',
    contentType: 'application/json',
    data: JSON.stringify({ domain: domain }),
    success: function(data){
      $('#domain_form').replaceWith(
        '<p>domain <span style="font-family:monospace">' + data.domain + '</span> added</p>');
      addWebhook(domain);
    },
    error: function(jqXHR, a, b) {
      $('#rowcont').prepend(errMsg(jqXHR.responseText));
    }
  });
});
