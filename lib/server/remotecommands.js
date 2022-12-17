'use strict';

var find_options = require('./query');

function storage(collection, ctx) {
  var ObjectID = require('mongodb').ObjectID;

  function create(obj, fn) {
    obj.created_at = (new Date()).toISOString();
    api().insert(obj, function (err, doc) {
      if (err != null && err.message) {
        console.log('Data insertion error', err.message);
        fn(err.message, null);
        return;
      }
      fn(null, doc);
    });
    ctx.bus.emit('data-received');
  }

  function save(obj, fn) {
    obj._id = new ObjectID(obj._id);
    if (!obj.created_at) {
      obj.created_at = (new Date()).toISOString();
    }
    api().save(obj, function (err) {
      //id should be added for new docs
      fn(err, obj);
    });
    ctx.bus.emit('data-received');
  }

  function list(opts, fn) {
    // these functions, find, sort, and limit, are used to
    // dynamically configure the request, based on the options we've
    // been given

    // determine sort options
    function sort() {
      return opts && opts.sort || { created_at: -1 };
    }

    // configure the limit portion of the current query
    function limit() {
      if (opts && opts.count) {
        return this.limit(parseInt(opts.count));
      }
      return this;
    }

    // handle all the results
    function toArray(err, entries) {
      fn(err, entries);
    }

    //TODO: The fn callback is not called when an error occurs, such as when a badly formatted mongo ID is requested.
    //The function(err, results) callback is only invoked by the toArray method.
    //Maybe this is ok though as this is how other cgm APIs seem to do it.

    // now just stitch them all together
    limit.call(api()
      .find(query_for(opts))
      .sort(sort())
    ).toArray(toArray);
  }

  function query_for(opts) {
    return find_options(opts, storage.queryOpts);
  }

  function remove(opts, fn) {

    function removed(err, stat) {

      ctx.bus.emit('data-update', {
        type: 'remotecommands'
        , op: 'remove'
        , count: stat.result.n
        , changes: opts.find._id
      });

      fn(err, stat);
    }

    return api().remove(
      query_for(opts), removed);
  }

  function api() {
    return ctx.store.collection(collection);
  }

  api.list = list;
  api.create = create;
  api.query_for = query_for;
  api.save = save;
  api.remove = remove;
  api.indexedFields = ['name']; //TODO: Other things to index?
  return api;
}

storage.queryOpts = {
  walker: {
    otp: parseInt,
    sendNotification: JSON.parse,
    _id: String
  },
  dateField: 'created_at'
};

module.exports = storage;