#!/usr/bin/python3
import psycopg2
from psycopg2 import pool as psycopg2_pool
from optparse import make_option
from multiprocessing import pool as multiproc_pool
import time
import os,sys,string
import logging
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG )
logger=logging.getLogger(__name__)
from decimal import Decimal, getcontext
getcontext().prec = 11
from geopy.geocoders import GeocoderDotUS, Nominatim, GoogleV3, GeoNames
from geopy.exc import GeocoderTimedOut
from contextlib import contextmanager


geolocator = GoogleV3( api_key=os.environ.get('GOOGLE_API_KEY', None) ) #GeoNames() Nominatim()
dbpool = None
tablename = None


@contextmanager
def get_connection():
    conn = dbpool.getconn()
    conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
    try:
        yield conn
    finally:
        dbpool.putconn(conn)

def geocode(prop):
    attrmap = {'pid': 0, 'address': 1, 'city': 2, 'state': 3, 'zip': 4, 'ward': 5 }
    full_address = "{} {}, {} {}".format(
        prop[attrmap['address']],
        prop[attrmap['city']] or '',
        prop[attrmap['state']] or '',
        prop[attrmap['zip']] or '',
    )
    if 'None' in full_address:
        logger.debug("[ SKIP ]: {}".format(full_address))

    try:
        location = geolocator.geocode(full_address)
        if location is None:
           logger.debug("[ NO LOCATION SKIP ]: {}".format(full_address))
           return
        logger.debug("[ GEOCODED ]: {}".format(location))
        with get_connection() as conn:
            crs = conn.cursor()
            crs.execute("UPDATE "+tablename+" SET the_geom = ST_SetSRID(ST_Point(%s, %s),4326), is_geocoded = 1 WHERE pid = %s",(location.longitude,location.latitude,prop[attrmap['pid']]))
    except Exception as e:
        logger.exception( e )


if __name__ == '__main__':
    #
    # check required environment variables are set
    #
    dbname,dbuser,tablename,google_api_key=os.environ.get('DBNAME',None),os.environ.get('DBUSER',None),os.environ.get('TABLE',None),os.environ.get('GOOGLE_API_KEY',None)
    if not all([dbname,dbuser,tablename,google_api_key]):
        logger.error("one of the following required environment variables is not set: DBNAME={} DBUSER={} TABLE={} GOOGLE_API_KEY={}".format(dbname,dbuser,tablename,google_api_key))
        sys.exit(1)
    logger.debug("DBNAME={} DBUSER={} TABLENAME={} GOOGLE_API_KEY={}".format(dbname,dbuser,tablename,google_api_key))

    # create pool with min number of connections of 1, max of 15
    dbpool = psycopg2_pool.SimpleConnectionPool(1,30,dbname=os.environ["DBNAME"],user=os.environ['DBUSER'])

    with get_connection() as conn:
        thread_pool = multiproc_pool.ThreadPool(processes=15)

        #
        # geocode tablename with an `address_of_record`
        #
        crs = conn.cursor()
        crs.execute("SELECT pid, address_of_record, city, state, postal_code, ward FROM "+tablename+" WHERE address_of_record IS NOT NULL AND reported_address IS NULL AND needs_geocoding = 1 and is_geocoded = 0")
        props1 = crs.fetchall()

        #
        # geocode tablename with no `address_of_record` but a `reported_address`
        #
        crs.execute("SELECT pid, reported_address, city, state, postal_code, ward from "+tablename+" WHERE reported_address IS NOT NULL AND needs_geocoding = 1 and is_geocoded = 0")
        props2 = crs.fetchall()

        thread_pool.imap(
            geocode,
            (prop for prop in props1+props2)
        )
        thread_pool.close()
        thread_pool.join() # block until finished