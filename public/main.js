var html = '';

function errMsg(msg) {
  return '<div class="alert alert-danger" role="alert"> '
    + '<strong>Oh snap!</strong> ' + msg + '</div>';
}

function addDomain(domain) {
  $.post('/inbound-domain', { domain: domain }, function(data, textStatus, jqXHR) {
    console.log('Yay!');
  });

  /*
  $.ajax({
    type: 'POST',
    dataType: 'json',
    data: {
      domain: domain
    },
    url: '/inbound-domain',
    success: function(data, textStatus, jqXHR){
      console.log('Yay!');
    },
    error: function(jqXHR, textStatus, errorThrown) {
      console.log('Boo!');
      $('#add_inbound_domain').replaceWith(errMsg(jqXHR.responseText));
    }
  });
  */
}

$.ajax({
  type: 'GET',
  dataType: 'json',
  url: '/inbound-domain',
  success: function(data, textStatus, jqXHR) {
    let rownum = 1;
    let domain = '<span style="font-family:monospace;">' + data.domain + '</span>';

    if (data.in_sparkpost) {
      $('#get_inbound_domain').replaceWith('<p>' + domain + ' configured</p>');
    } else {
      $('#get_inbound_domain').replaceWith('<p>' + domain + ' not yet configured in SparkPost</p>');

      $('#rowcont').append(
        '<div id="row2" class="row"><div class="col-md-6"><p>Adding Inbound Domain...</p>'
        + '</div><div class="col-md-6"><p id="add_inbound_domain"></p></div></div>'
      );
      addDomain(data.domain);
    }
  },
  error: function(jqXHR, textStatus, errorThrown) {
    $('#get_inbound_domain').replaceWith(errMsg(jqXHR.responseText));
  }
});
